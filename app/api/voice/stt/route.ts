import { NextRequest, NextResponse } from 'next/server'
import { CartesiaError, isTranscriptionConfigured, transcribeAudio } from '@/lib/cartesia'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isTranscriptionConfigured()) {
    return NextResponse.json(
      { error: 'Voice input is not configured. Add CARTESIA_API_KEY to your environment variables.' },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart recording.' }, { status: 400 })
  }

  const file = form.get('audio')
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'No audio was uploaded.' }, { status: 400 })
  }

  const language = typeof form.get('language') === 'string' ? String(form.get('language')) : undefined

  try {
    const result = await transcribeAudio({ file, language })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof CartesiaError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status })
  }
}
