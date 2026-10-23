import { NextRequest, NextResponse } from 'next/server'
import { ResearchCancelledError, performResearchWithStreaming } from '@/lib/open-researcher-agent'
import { isProviderConfigured, providerDefaults, resolveProvider } from '@/lib/llm'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Check the language model key for the active provider (Sarvam by
    // default, Anthropic as a fallback).
    const provider = resolveProvider()
    if (!isProviderConfigured(provider)) {
      const { apiKeyEnv } = providerDefaults(provider)
      return NextResponse.json(
        { error: `${apiKeyEnv} is not configured. Add it to your environment variables (see .env.local.example).` },
        { status: 500 }
      )
    }

    // Get Firecrawl API key from headers first, then fall back to environment variables
    const firecrawlApiKey = req.headers.get('X-Firecrawl-API-Key') || process.env.FIRECRAWL_API_KEY

    if (!firecrawlApiKey) {
      // FIRECRAWL_API_KEY is not configured
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY is not configured. Please add it via the interface.' },
        { status: 500 }
      )
    }
    
    // The key travels with the request; writing it to process.env would let
    // two concurrent users overwrite each other's credentials.

    // API Keys configured successfully

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // The browser can disappear mid-run (tab closed, navigation, flaky
        // network). Once that happens the controller is dead: enqueue throws,
        // and the agent should stop rather than keep spending tokens.
        let closed = false

        const send = (payload: Record<string, unknown>) => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            closed = true
          }
        }

        const finish = () => {
          if (closed) return
          closed = true
          try {
            controller.close()
          } catch {
            // Client already gone.
          }
        }

        req.signal.addEventListener('abort', () => {
          closed = true
        })

        try {
          // Perform research with streaming events
          const finalResponse = await performResearchWithStreaming(
            query,
            (event) => {
              // Add timestamp to events
              send({ type: 'event', event: { ...event, timestamp: Date.now() } })
            },
            { firecrawlApiKey, signal: req.signal }
          )

          // Send final response
          if (finalResponse) {
            send({ type: 'response', content: finalResponse })
          }

          // Send done event
          send({ type: 'done' })
          finish()
        } catch (error) {
          // A cancelled run is not a failure; the reader is gone.
          if (error instanceof ResearchCancelledError || req.signal.aborted) {
            closed = true
            return
          }

          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const errorDetails = error instanceof Error && error.stack ? error.stack : ''

          // More user-friendly error messages
          let userFriendlyError = errorMessage
          if (errorMessage.includes('Authentication error')) {
            userFriendlyError = `The language model API key was rejected. Check ${providerDefaults(provider).apiKeyEnv}.`
          } else if (errorMessage.includes('Model error')) {
            userFriendlyError = `The configured model is not available for this API key (${providerDefaults(provider).model}). Set SARVAM_MODEL (or ANTHROPIC_MODEL).`
          } else if (errorMessage.includes('FIRECRAWL_API_KEY')) {
            userFriendlyError = 'The Firecrawl API key is not configured. Add it in the app or as FIRECRAWL_API_KEY.'
          }

          send({
            type: 'error',
            error: userFriendlyError,
            originalError: errorMessage,
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
          })
          finish()
        }
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        // Some hosts and proxies buffer a stream until it closes, which makes
        // the live thinking view arrive all at once at the end.
        'X-Accel-Buffering': 'no',
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