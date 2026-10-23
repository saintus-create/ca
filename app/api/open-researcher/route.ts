import { NextRequest, NextResponse } from 'next/server'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'
import { isProviderConfigured, providerDefaults, resolveProvider } from '@/lib/llm'
import { executeCorpusSearch } from '@/lib/corpus-search'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/**
 * Answers straight from the California corpus, labelled as such.
 *
 * Used when the language model is missing, or configured but unusable (no
 * credit, revoked key, retired model). A broken model key must not take the
 * site down - the corpus is the part that always works.
 */
function corpusOnlyResponse(query: string, reason: string): NextResponse {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      try {
        const { content } = await executeCorpusSearch(query, undefined, 6)
        const notice =
          `> **Corpus-only result.** ${reason} This is a direct search of the ` +
          `California corpus rather than a reasoned answer.\n\n`
        send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query }, timestamp: Date.now() } })
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
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Web search is optional. The California corpus needs no key, so a missing
    // Firecrawl key degrades the run to corpus-only rather than failing it.
    const firecrawlApiKey = req.headers.get('X-Firecrawl-API-Key') || process.env.FIRECRAWL_API_KEY
    if (firecrawlApiKey) process.env.FIRECRAWL_API_KEY = firecrawlApiKey

    // Check the language model key for the active provider (Sarvam by
    // default, Venice and Anthropic as alternatives).
    const provider = resolveProvider()
    const { apiKeyEnv } = providerDefaults(provider)

    if (!isProviderConfigured(provider)) {
      return corpusOnlyResponse(
        query,
        `No language model is configured on this deployment (\`${apiKeyEnv}\` is unset).`
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        try {
          const finalResponse = await performResearchWithStreaming(query, (event) => {
            send({ type: 'event', event: { ...event, timestamp: Date.now() } })
          })

          if (finalResponse) send({ type: 'response', content: finalResponse })
          send({ type: 'done' })
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          // A configured-but-unusable key must not take the site down either.
          try {
            const { content } = await executeCorpusSearch(query, undefined, 6)
            const notice =
              `> **Corpus-only result.** The language model is unavailable on this ` +
              `deployment (${errorMessage}), so this is a direct search of the California ` +
              `corpus rather than a reasoned answer.\n\n`
            send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query }, timestamp: Date.now() } })
            send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: content, timestamp: Date.now() } })
            send({ type: 'response', content: notice + content })
            send({ type: 'done' })
            controller.close()
            return
          } catch {
            // Corpus unavailable too - fall through and report the model error.
          }

          let userFriendlyError = errorMessage
          if (errorMessage.includes('Authentication error')) {
            userFriendlyError = `The language model API key was rejected. Check ${apiKeyEnv}.`
          } else if (errorMessage.includes('Model error')) {
            userFriendlyError = `The configured model is not available for this API key (${providerDefaults(provider).model}). Set SARVAM_MODEL (or VENICE_MODEL / ANTHROPIC_MODEL).`
          } else if (errorMessage.includes('FIRECRAWL_API_KEY')) {
            userFriendlyError = 'The Firecrawl API key is not configured. Add it in the app or as FIRECRAWL_API_KEY.'
          }

          send({ type: 'error', error: userFriendlyError, originalError: errorMessage })
          controller.close()
        }
      },
    })

    return new NextResponse(stream, { headers: SSE_HEADERS })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}
