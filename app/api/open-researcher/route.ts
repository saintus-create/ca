import { NextRequest, NextResponse } from 'next/server'
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
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Perform research with streaming events
          const finalResponse = await performResearchWithStreaming(query, (event) => {
            // Add timestamp to events
            const eventWithTimestamp = { ...event, timestamp: Date.now() }
            
            // Send event as SSE
            const data = `data: ${JSON.stringify({ type: 'event', event: eventWithTimestamp })}\n\n`
            controller.enqueue(encoder.encode(data))
          }, scopeDataset, firecrawlApiKey, chatOptions)

          // Send final response
          if (finalResponse) {
            const responseData = `data: ${JSON.stringify({ type: 'response', content: finalResponse })}\n\n`
            controller.enqueue(encoder.encode(responseData))
          }

          // Send done event
          const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`
          controller.enqueue(encoder.encode(doneData))
          controller.close()
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
            userFriendlyError = `The configured model is not available for this API key (${providerDefaults(provider).model}). Set SARVAM_MODEL (or VENICE_MODEL / ANTHROPIC_MODEL).`
          } else if (errorMessage.includes('FIRECRAWL_API_KEY')) {
            userFriendlyError = 'The Firecrawl API key is not configured. Add it in the app or as FIRECRAWL_API_KEY.'
          }
          
          const errorData = `data: ${JSON.stringify({ 
            type: 'error', 
            error: userFriendlyError,
            originalError: errorMessage,
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
          })}\n\n`
          controller.enqueue(encoder.encode(errorData))
          controller.close()
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