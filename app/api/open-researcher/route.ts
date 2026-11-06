import { NextRequest, NextResponse } from 'next/server'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'
import { searchCorpus, type CorpusHit } from '@/lib/corpus-search'
import {
  isProviderConfigured,
  providerDefaults,
  providerForKey,
  resolveProvider,
  type LlmProvider,
} from '@/lib/llm'
import { LIMITS, optionalString, readJsonObject, requiredString } from '@/lib/validate'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/** One corpus hit as a section of a document, not a line in a dump. */
function renderHit(hit: CorpusHit, index: number): string {
  const heading =
    hit.title && hit.title.trim() && hit.title.trim() !== hit.citation.trim()
      ? `${hit.citation} — ${hit.title}`
      : hit.citation
  const snippet = hit.snippet.replace(/\s+/g, ' ').trim()
  const source = hit.url ? `\n\n[Open the section](${hit.url})` : ''
  return `### ${index + 1}. ${heading}\n\n> ${snippet}${source}`
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
        const hits = await searchCorpus(query, dataset, 6)
        const body = hits.length
          ? hits.map(renderHit).join('\n\n')
          : '_No matching sections. Try a section number, e.g. “PEN 459”, or a different phrase._'
        const intro = hits.length
          ? `**${hits.length} ${hits.length === 1 ? 'section' : 'sections'}** in the California corpus for “${query}”.`
          : `No sections in the California corpus matched “${query}”.`
        const notice = `> **Corpus-only result.** ${reason}\n\n`

        send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query, dataset }, timestamp: Date.now() } })
        send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: hits.map((h) => `[${h.citation}] ${h.snippet}`).join('\n\n'), timestamp: Date.now() } })
        send({ type: 'response', content: `${notice}${intro}\n\n${body}` })
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
    const bodyResult = await readJsonObject(req)
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 })
    const body = bodyResult.value

    const queryResult = requiredString(body.query, 'query', { max: LIMITS.query })
    if (!queryResult.ok) return NextResponse.json({ error: queryResult.error }, { status: 400 })
    const query = queryResult.value

    const datasetResult = optionalString(body.dataset, 'dataset', {
      max: 6,
      pattern: /^[A-Z]{2,6}$/,
      patternHint: 'a 2–6 letter uppercase code',
    })
    if (!datasetResult.ok) return NextResponse.json({ error: datasetResult.error }, { status: 400 })
    const scopeDataset = datasetResult.value

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
            browserProvider === 'cloudflare' ||
            browserProvider === 'orchestrate'
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
    // A disconnected browser cancels the stream; that has to stop the research
    // loop and any in-flight model call, or the run keeps spending tokens for a
    // client that has gone and only stops when enqueue throws mid-agent.
    const abort = new AbortController()
    let closed = false
    const stream = new ReadableStream({
      cancel() {
        closed = true
        abort.abort()
      },
      async start(controller) {
        const send = (payload: unknown) => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            closed = true
            abort.abort()
          }
        }
        try {
          // Perform research with streaming events
          const finalResponse = await performResearchWithStreaming(query, (event) => {
            // Add timestamp to events
            const eventWithTimestamp = { ...event, timestamp: Date.now() }
            send({ type: 'event', event: eventWithTimestamp })
          }, scopeDataset, firecrawlApiKey, chatOptions, abort.signal)

          // Send final response
          if (finalResponse) {
            send({ type: 'response', content: finalResponse })
          }

          // Send done event
          send({ type: 'done' })
          closed = true
          try {
            controller.close()
          } catch {
            /* the cancel handler already closed it */
          }
        } catch (error) {
          // Research error occurred
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorDetails = error instanceof Error && error.stack ? error.stack : ''

          // A configured-but-unusable key must not take the chat down either:
          // fall back to the corpus, labelled, before surfacing an error.
          try {
            const hits = await searchCorpus(query, scopeDataset, 6)
            if (hits.length > 0) {
              const notice =
                `> **Corpus-only result.** The language model is unavailable on this ` +
                `deployment (${errorMessage}), so this is a direct search of the California ` +
                `corpus rather than a reasoned answer.\n\n`
              const intro = `**${hits.length} ${hits.length === 1 ? 'section' : 'sections'}** in the California corpus for “${query}”.\n\n`
              send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query, dataset: scopeDataset }, timestamp: Date.now() } })
              send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: hits.map((h) => `[${h.citation}] ${h.snippet}`).join('\n\n'), timestamp: Date.now() } })
              send({ type: 'response', content: notice + intro + hits.map(renderHit).join('\n\n') })
              send({ type: 'done' })
              closed = true
              try {
                controller.close()
              } catch {
                /* already closed */
              }
              return
            }
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

          if (!abort.signal.aborted) {
            send({
              type: 'error',
              error: userFriendlyError,
              originalError: errorMessage,
              details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
            })
          }
          closed = true
          try {
            controller.close()
          } catch {
            /* already closed */
          }
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
