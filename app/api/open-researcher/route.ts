import { NextRequest, NextResponse } from 'next/server'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'
import { executeCorpusSearch } from '@/lib/corpus-search'
import {
  isProviderConfigured,
  providerDefaults,
  providerForKey,
  resolveProvider,
  type LlmProvider,
} from '@/lib/llm'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/**
 * Answers straight from the California corpus, labelled as such.
 *
 * Used when the language model is missing, or configured but unusable (no
 * credit, rejected key, retired model). A model problem must not take the chat
 * down: the corpus is the part that always works.
 */
function corpusOnlyResponse(query: string, dataset: string | undefined, reason: string): NextResponse {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      try {
        const { content } = await executeCorpusSearch(query, dataset, 6)
        const notice =
          `> **Corpus-only result.** ${reason} This is a direct search of the ` +
          `California corpus rather than a reasoned answer.\n\n`
        send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query, dataset }, timestamp: Date.now() } })
        send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: content, timestamp: Date.now() } })
        send({ type: 'response', content: notice + content })
        send({ type: 'done' })
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : 'Corpus search failed.' })
      } finally {
        controller.close()
      }
    },
  })
  return new NextResponse(stream, { headers: SSE_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const { query, dataset } = await req.json()
    const scopeDataset = typeof dataset === 'string' && dataset.trim() ? dataset.trim() : undefined

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // A key supplied by the browser for this request only. It takes precedence
    // over the deployment's environment variable and is never written into
    // process.env, so it cannot leak into another visitor's request.
    const browserKey = req.headers.get('X-LLM-API-Key')?.trim() || undefined
    const browserProvider = req.headers.get('X-LLM-Provider')?.trim().toLowerCase()
    const chatOptions = browserKey
      ? {
          apiKey: browserKey,
          provider:
            browserProvider === 'sarvam' ||
            browserProvider === 'venice' ||
            browserProvider === 'anthropic' ||
            browserProvider === 'cloudflare'
              ? (browserProvider as LlmProvider)
              : undefined,
          accountId: req.headers.get('X-Cloudflare-Account')?.trim() || undefined,
        }
      : undefined

    // Check the language model key for the active provider (Sarvam by
    // default, Anthropic as a fallback).
    const provider = chatOptions?.provider ?? providerForKey(browserKey) ?? resolveProvider()

    // No usable model: answer from the corpus rather than dead-ending the chat.
    if (!isProviderConfigured(provider, browserKey)) {
      const { apiKeyEnv } = providerDefaults(provider)
      return corpusOnlyResponse(
        query,
        scopeDataset,
        `No language model is configured on this deployment (\`${apiKeyEnv}\` is unset). Add your key in the app, or set ${apiKeyEnv}.`
      )
    }

    // Firecrawl is optional. A key supplied through the UI takes precedence;
    // without one, the California law corpus and the language model still run,
    // and only the web search/scrape tools return a tool-level error if used.
    // Passed down per request rather than written into process.env, so a key
    // supplied by one visitor is never reused by the next request.
    const firecrawlApiKey = req.headers.get('X-Firecrawl-API-Key')?.trim() || undefined

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        try {
          // Perform research with streaming events
          const finalResponse = await performResearchWithStreaming(query, (event) => {
            // Add timestamp to events
            const eventWithTimestamp = { ...event, timestamp: Date.now() }
            send({ type: 'event', event: eventWithTimestamp })
          }, scopeDataset, firecrawlApiKey, chatOptions)

          // Send final response
          if (finalResponse) {
            send({ type: 'response', content: finalResponse })
          }

          // Send done event
          send({ type: 'done' })
          controller.close()
        } catch (error) {
          // Research error occurred
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorDetails = error instanceof Error && error.stack ? error.stack : ''

          // A configured-but-unusable key must not take the chat down either:
          // fall back to the corpus, labelled, before surfacing an error.
          try {
            const { content } = await executeCorpusSearch(query, scopeDataset, 6)
            const notice =
              `> **Corpus-only result.** The language model is unavailable on this ` +
              `deployment (${errorMessage}), so this is a direct search of the California ` +
              `corpus rather than a reasoned answer.\n\n`
            send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query, dataset: scopeDataset }, timestamp: Date.now() } })
            send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: content, timestamp: Date.now() } })
            send({ type: 'response', content: notice + content })
            send({ type: 'done' })
            controller.close()
            return
          } catch {
            // Corpus unavailable too - fall through and report the model error.
          }

          // More user-friendly error messages
          let userFriendlyError = errorMessage
          if (errorMessage.includes('Authentication error')) {
            userFriendlyError = `The language model API key was rejected. Check ${providerDefaults(provider).apiKeyEnv}.`
          } else if (errorMessage.includes('Model error')) {
            userFriendlyError = `The configured model is not available for this API key (${providerDefaults(provider).model}). Set SARVAM_MODEL (or VENICE_MODEL / ANTHROPIC_MODEL).`
          } else if (errorMessage.includes('FIRECRAWL_API_KEY')) {
            userFriendlyError = 'The Firecrawl API key is not configured. Add it in the app or as FIRECRAWL_API_KEY.'
          }

          send({
            type: 'error',
            error: userFriendlyError,
            originalError: errorMessage,
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
          })
          controller.close()
        }
      }
    })

    return new NextResponse(stream, { headers: SSE_HEADERS })
  } catch (error) {
    // API route error occurred
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        hint: 'Check the Vercel function logs for more details'
      },
      { status: 500 }
    )
  }
}
