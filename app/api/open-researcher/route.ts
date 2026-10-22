import { NextRequest, NextResponse } from 'next/server'
import { performResearchWithStreaming } from '@/lib/open-researcher-agent'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Check for Anthropic API key in environment
    if (!process.env.ANTHROPIC_API_KEY) {
      // ANTHROPIC_API_KEY is not configured in environment variables
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your Vercel environment variables.' },
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
    
    // Set Firecrawl API key as environment variable for the agent to use
    process.env.FIRECRAWL_API_KEY = firecrawlApiKey
    
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
          if (errorMessage.includes('Model error')) {
            userFriendlyError = 'The Anthropic claude-opus-4 model is not available. This might be due to regional restrictions or API tier limitations.'
          } else if (errorMessage.includes('Beta feature error')) {
            userFriendlyError = 'The interleaved thinking feature is not enabled for your Anthropic API key. This is a beta feature that may require special access.'
          } else if (errorMessage.includes('Authentication error')) {
            userFriendlyError = 'Invalid Anthropic API key. Please check your environment variables in Vercel.'
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