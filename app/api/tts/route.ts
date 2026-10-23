import { NextRequest, NextResponse } from 'next/server'

const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes'
const DEFAULT_MODEL = 'sonic-3.6'
const DEFAULT_VOICE_ID = 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4' // Skylar — Friendly Guide
const DEFAULT_VERSION = '2026-08-14'
const MAX_TEXT_LENGTH = 5000

export async function POST(req: NextRequest) {
  // Read the key by destructuring so the value stays out of this source file.
  const { CARTESIA_API_KEY } = process.env

  if (!CARTESIA_API_KEY) {
    return NextResponse.json(
      {
        error:
          'CARTESIA_API_KEY is not configured. Add it to your environment variables (see .env.local.example).',
      },
      { status: 500 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }

  const transcript =
    body && typeof body === 'object' && 'text' in body && typeof body.text === 'string'
      ? body.text.trim()
      : ''

  if (!transcript) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
  }

  if (transcript.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text is too long for one speech request (maximum ${MAX_TEXT_LENGTH} characters).` },
      { status: 413 }
    )
  }

  try {
    const response = await fetch(CARTESIA_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cartesia-Version': process.env.CARTESIA_VERSION?.trim() || DEFAULT_VERSION,
        // Cartesia's current API references use both key-header conventions
        // across endpoints; sending both keeps this route compatible.
        'X-API-Key': CARTESIA_API_KEY,
        Authorization: `Bearer ${CARTESIA_API_KEY}`,
      },
      body: JSON.stringify({
        model_id: process.env.CARTESIA_MODEL?.trim() || DEFAULT_MODEL,
        transcript,
        voice: {
          mode: 'id',
          id: process.env.CARTESIA_VOICE_ID?.trim() || DEFAULT_VOICE_ID,
        },
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000,
        },
        language: 'en',
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      const raw = await response.text()
      let detail = raw.slice(0, 300)
      try {
        const parsed = JSON.parse(raw) as { error?: string; message?: string }
        detail = parsed.error || parsed.message || detail
      } catch {
        // Keep the short raw response detail.
      }

      const message =
        response.status === 401 || response.status === 403
          ? 'Cartesia rejected CARTESIA_API_KEY. Check the key and try again.'
          : `Cartesia speech generation failed (${response.status}). ${detail}`

      return NextResponse.json({ error: message }, { status: 502 })
    }

    if (!response.body) {
      return NextResponse.json(
        { error: 'Cartesia returned an empty audio response.' },
        { status: 502 }
      )
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'Cartesia took too long to generate speech. Please try again.'
        : 'Could not reach Cartesia to generate speech. Please try again.'

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
