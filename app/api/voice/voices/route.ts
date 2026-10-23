import { NextResponse } from 'next/server'
import { CartesiaError, isCartesiaConfigured, listVoices, resolveVoiceId } from '@/lib/cartesia'

export const runtime = 'nodejs'

// The voice list changes rarely; a short server cache (in lib/cartesia.ts)
// plus no-store here keeps the picker current without hammering the API.
export async function GET(req: Request) {
  if (!isCartesiaConfigured()) {
    return NextResponse.json(
      { error: 'Voice is not configured. Add CARTESIA_API_KEY to your environment variables.', voices: [] },
      { status: 503 }
    )
  }

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'

  try {
    const voices = await listVoices(refresh)
    const defaultVoiceId = await resolveVoiceId().catch(() => null)

    return NextResponse.json(
      { voices, defaultVoiceId },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const status = error instanceof CartesiaError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Could not load voices.'
    return NextResponse.json({ error: message, voices: [] }, { status })
  }
}
