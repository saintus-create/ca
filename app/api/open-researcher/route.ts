import { NextRequest, NextResponse } from 'next/server'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'
import { isProviderConfigured, providerDefaults, resolveProvider } from '@/lib/llm'
import { executeCorpusSearch } from '@/lib/corpus-search'

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
      // No language model is configured. Rather than a dead end, answer
      // directly from the California corpus — and say plainly that this is
      // what happened, so a corpus search is never mistaken for a reasoned
      // answer.
      const { content } = await executeCorpusSearch(query, undefined, 6)
      const notice =
        `> **Corpus-only result.** No language model is configured on this deployment ` +
        `(\`${apiKeyEnv}\` is unset), so this is a direct search of the California corpus ` +
        `rather than a reasoned answer. Set \`${apiKeyEnv}\` to enable full research.\n\n`
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const send = (payload: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          send({ type: 'event', event: { type: 'tool_call', tool: 'search_california_law', parameters: { query }, timestamp: Date.now() } })
          send({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: content, timestamp: Date.now() } })
          send({ type: 'response', content: notice + content })
          send({ type: 'done' })
          controller.close()
        },
      })
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Web search is optional. The California corpus needs no key, so a missing
    // Firecrawl key degrades the run to corpus-only rather than failing it.
    const firecrawlApiKey = req.headers.get('X-Firecrawl-API-Key') || process.env.FIRECRAWL_API_KEY
    if (firecrawlApiKey) process.env.FIRECRAWL_API_KEY = firecrawlApiKey
    
    // API Keys configured successfully

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
          })

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
            userFriendlyError = `The configured model is not available for this API key (${providerDefaults(provider).model}). Set SARVAM_MODEL (or ANTHROPIC_MODEL).`
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