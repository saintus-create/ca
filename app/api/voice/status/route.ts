import { NextResponse } from 'next/server'
import { isCartesiaConfigured, isSpeechConfigured, isTranscriptionConfigured, resolveVoiceId } from '@/lib/cartesia'

export const runtime = 'nodejs'

/**
 * What voice the deployment can do, for the chat screen to branch on.
 *
 * The screen needs this before it renders: with Cartesia configured, Listen
 * streams Sonic and the picker lists the account's voices; without a key,
 * Listen falls back to the browser's own voice and the picker is hidden. No
 * secret is involved, so it is safe to answer without a key.
 */
export async function GET() {
  const configured = isCartesiaConfigured()
  const defaultVoiceId = configured ? await resolveVoiceId().catch(() => null) : null

  return NextResponse.json(
    {
      configured,
      speech: isSpeechConfigured(),
      transcription: isTranscriptionConfigured(),
      defaultVoiceId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
