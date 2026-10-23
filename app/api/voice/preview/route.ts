import { NextResponse } from 'next/server'
import { CartesiaError, isCartesiaConfigured, listVoices } from '@/lib/cartesia'

export const runtime = 'nodejs'

/**
 * Streams a voice preview.
 *
 * Cartesia's preview URLs require the same Authorization header as the API, so
 * the browser cannot play them directly. We look the URL up from the voice
 * list (never from the query string) and proxy the bytes, which keeps this
 * from becoming an open relay.
 */
export async function GET(req: Request) {
  if (!isCartesiaConfigured()) {
    return NextResponse.json({ error: 'Voice is not configured.' }, { status: 503 })
  }

  const voiceId = new URL(req.url).searchParams.get('voiceId')
  if (!voiceId) {
    return NextResponse.json({ error: 'voiceId is required.' }, { status: 400 })
  }

  try {
    const voices = await listVoices()
    const voice = voices.find((candidate) => candidate.id === voiceId)

    if (!voice) {
      return NextResponse.json({ error: 'Unknown voice.' }, { status: 404 })
    }
    if (!voice.previewUrl) {
      return NextResponse.json({ error: 'This voice has no preview.' }, { status: 404 })
    }

    const upstream = await fetch(voice.previewUrl, {
      headers: { Authorization: `Bearer ${process.env.CARTESIA_API_KEY}` },
      signal: AbortSignal.timeout(20_000),
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Preview is unavailable right now.' }, { status: 502 })
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    const status = error instanceof CartesiaError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Could not load the preview.'
    return NextResponse.json({ error: message }, { status })
  }
}
