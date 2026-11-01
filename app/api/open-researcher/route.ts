import { NextRequest, NextResponse } from 'next/server'
import { DATASET_PATTERN, LIMITS, optionalString, readJsonObject, requiredString } from '@/lib/validate'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'
import {
  isProviderConfigured,
  providerDefaults,
  providerForKey,
  resolveProvider,
  type LlmProvider,
} from '@/lib/llm'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req)
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

    const queryResult = requiredString(body.value.query, 'query', { max: LIMITS.query })
    if (!queryResult.ok) return NextResponse.json({ error: queryResult.error }, { status: 400 })
    const query = queryResult.value

    const datasetResult = optionalString(body.value.dataset, 'dataset', {
      max: 6,
      pattern: DATASET_PATTERN,
      patternHint: 'a dataset code such as CIV or PEN',
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
            browserProvider === 'cloudflare'
              ? (browserProvider as LlmProvider)
              : undefined,
          accountId: req.headers.get('X-Cloudflare-Account')?.trim() || undefined,
          model: req.headers.get('X-LLM-Model')?.trim() || undefined,
        }
      : undefined

    // Check the language model key for the active provider (Sarvam by
    // default, Anthropic as a fallback).
    const provider = chatOptions?.provider ?? providerForKey(browserKey) ?? resolveProvider()
    if (!isProviderConfigured(provider, browserKey)) {
      const { apiKeyEnv } = providerDefaults(provider)
      return NextResponse.json(
        { error: `${apiKeyEnv} is not configured. Add your key in the app (API keys in the menu) or set ${apiKeyEnv} in the environment.` },
        { status: 500 }
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
    // loop and any in-flight model call. Without this the run kept going to
    // completion, spending tokens for a client that had gone, and only stopped
    // when enqueue threw into the middle of the agent.
    const abort = new AbortController()
    let closed = false
    const send = (controller: ReadableStreamDefaultController<Uint8Array>, payload: string) => {
      if (closed) return
      try {
        controller.enqueue(encoder.encode(payload))
      } catch {
        closed = true
        abort.abort()
      }
    }

    const stream = new ReadableStream({
      cancel() {
        closed = true
        abort.abort()
      },
      async start(controller) {
        try {
          // Perform research with streaming events
          const finalResponse = await performResearchWithStreaming(query, (event) => {
            // Add timestamp to events
            const eventWithTimestamp = { ...event, timestamp: Date.now() }
            
            // Send event as SSE
            const data = `data: ${JSON.stringify({ type: 'event', event: eventWithTimestamp })}\n\n`
            send(controller, data)
          }, scopeDataset, firecrawlApiKey, chatOptions, abort.signal)

          // Send final response
          if (finalResponse) {
            send(controller, `data: ${JSON.stringify({ type: 'response', content: finalResponse })}\n\n`)
          }

          // Send done event
          send(controller, `data: ${JSON.stringify({ type: 'done' })}\n\n`)
          closed = true
          try {
            controller.close()
          } catch {
            /* already closed by the cancel handler */
          }
        } catch (error) {
          // Research error occurred
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorDetails = error instanceof Error && error.stack ? error.stack : ''
          
          // Error details logged internally
          
          // More user-friendly error messages
          let userFriendlyError = errorMessage
          if (errorMessage.includes('Authentication error')) {
            userFriendlyError = `The language model API key was rejected. Check ${providerDefaults(provider).apiKeyEnv}.`
          } else if (errorMessage.includes('Model error')) {
            const { model, apiKeyEnv } = providerDefaults(provider)
            const modelEnv = apiKeyEnv.replace(/_API_(KEY|TOKEN)$/, '_MODEL')
            userFriendlyError = `The configured model is not available for this key (${model}). Set ${modelEnv}, or pick another model in the app.`
          } else if (errorMessage.includes('FIRECRAWL_API_KEY')) {
            userFriendlyError = 'The Firecrawl API key is not configured. Add it in the app or as FIRECRAWL_API_KEY.'
          }
          
          // A cancelled run is not a failure to report to a client that left.
          if (!abort.signal.aborted) {
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: userFriendlyError,
              originalError: errorMessage,
              details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            })}\n\n`
            send(controller, errorData)
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

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    // API route error occurred
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log more details for debugging
    // Full error details logged internally
    
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