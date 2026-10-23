import { NextRequest, NextResponse } from 'next/server'
import { CartesiaError, MAX_TTS_CHARS, isSpeechConfigured, synthesizeSpeech } from '@/lib/cartesia'
import { toSpeakableText } from '@/lib/speakable'

export const runtime = 'nodejs'

// Audio responses are generated per request and vary by voice/speed, so they
// must never be cached by a CDN or the browser's back/forward cache.
const AUDIO_HEADERS = {
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'no-store, no-transform',
  'X-Accel-Buffering': 'no',
}

export async function POST(req: NextRequest) {
  if (!isSpeechConfigured()) {
    return NextResponse.json(
      { error: 'Voice is not configured. Add CARTESIA_API_KEY to your environment variables.' },
      { status: 503 }
    )
  }

  let body: { text?: string; voiceId?: string; speed?: number; language?: string; markdown?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const raw = (body.text || '').trim()
  if (!raw) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
  }

  // Answers arrive as markdown; speak the words, not the syntax.
  const text = body.markdown === false ? raw : toSpeakableText(raw, { maxChars: MAX_TTS_CHARS })

  if (!text) {
    return NextResponse.json({ error: 'Nothing left to speak after removing formatting.' }, { status: 400 })
  }

  try {
    const upstream = await synthesizeSpeech({
      text,
      voiceId: body.voiceId,
      speed: body.speed,
      language: body.language,
    })

    // Pipe Cartesia's stream straight through: the first words start playing
    // while the rest of the answer is still being generated.
    return new NextResponse(upstream.body, { status: 200, headers: AUDIO_HEADERS })
  } catch (error) {
    const status = error instanceof CartesiaError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Speech generation failed.'
    return NextResponse.json({ error: message }, { status })
  }
}
