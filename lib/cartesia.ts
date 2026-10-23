// Cartesia voice layer: Sonic for text-to-speech, Ink for speech-to-text.
//
// Server-only. Every call is proxied through a route handler so the API key
// never reaches the browser. That also means we do not need Cartesia access
// tokens or a token-refresh flow on the client: the browser talks to this app,
// this app talks to Cartesia.
//
// Config:
//   CARTESIA_API_KEY    required to enable voice
//   CARTESIA_VOICE_ID   default voice; otherwise the first voice on the account
//   CARTESIA_TTS_MODEL  default sonic-3.6
//   CARTESIA_STT_MODEL  default ink-whisper (the batch transcription model)
//   CARTESIA_VERSION    default 2026-08-14
//   CARTESIA_BASE_URL   self-hosting / test double; default api.cartesia.ai

export const CARTESIA_API_VERSION = process.env.CARTESIA_VERSION || '2026-08-14'

const DEFAULT_BASE_URL = 'https://api.cartesia.ai'
const DEFAULT_TTS_MODEL = 'sonic-3.6'
const DEFAULT_STT_MODEL = 'ink-whisper'

// Roughly ten minutes of speech. Anything longer is a mistake, and the limit
// keeps a stray paste from turning into a bill.
export const MAX_TTS_CHARS = 12000

export class CartesiaError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'CartesiaError'
    this.status = status
  }
}

export interface CartesiaVoice {
  id: string
  name: string
  tagline: string
  gender: string | null
  language: string | null
  previewUrl: string | null
  isOwner: boolean
}

export function isCartesiaConfigured(): boolean {
  return Boolean(process.env.CARTESIA_API_KEY)
}

/** True when the deployment can speak answers back. */
export function isSpeechConfigured(): boolean {
  return isCartesiaConfigured()
}

/** True when the deployment can transcribe a recording. */
export function isTranscriptionConfigured(): boolean {
  return isCartesiaConfigured()
}

function baseUrl(): string {
  return (process.env.CARTESIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function requireApiKey(): string {
  const key = process.env.CARTESIA_API_KEY
  if (!key) {
    throw new CartesiaError(
      'CARTESIA_API_KEY is not configured. Add it to your environment variables (see .env.local.example).',
      503
    )
  }
  return key
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireApiKey()}`,
    'Cartesia-Version': CARTESIA_API_VERSION,
  }
}

/** Turns an upstream failure into something we can show a user. */
async function upstreamError(res: Response, action: string): Promise<CartesiaError> {
  let detail = ''
  try {
    const body = await res.text()
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string; detail?: string }
      detail = parsed.message || parsed.error || parsed.detail || body
    } catch {
      detail = body
    }
  } catch {
    // Body already consumed or empty; fall through to the status text.
  }

  const message = detail
    ? `Cartesia ${action} failed (${res.status}): ${detail.slice(0, 300)}`
    : `Cartesia ${action} failed with status ${res.status}.`

  // 401/403 are the user's to fix (bad or missing key), so pass them through
  // rather than pretending the voice service is down.
  const status = res.status === 401 || res.status === 403 ? res.status : 502
  return new CartesiaError(message, status)
}

/**
 * Streams MP3 audio for `text`.
 *
 * Returns the upstream Response so the route can pipe `res.body` straight to
 * the browser: audio starts playing while the rest is still being generated.
 */
export async function synthesizeSpeech(options: {
  text: string
  voiceId?: string
  speed?: number
  language?: string
}): Promise<Response> {
  const text = options.text.trim()

  if (!text) {
    throw new CartesiaError('Nothing to speak: the text was empty.', 400)
  }
  if (text.length > MAX_TTS_CHARS) {
    throw new CartesiaError(
      `That answer is too long to read aloud in one go (${text.length} characters, limit ${MAX_TTS_CHARS}).`,
      413
    )
  }

  const voiceId = await resolveVoiceId(options.voiceId)

  const res = await fetch(`${baseUrl()}/tts/bytes`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: process.env.CARTESIA_TTS_MODEL || DEFAULT_TTS_MODEL,
      transcript: text,
      voice: voiceId,
      language: options.language || 'en',
      output_format: {
        container: 'mp3',
        sample_rate: 44100,
        bit_rate: 128000,
      },
      generation_config: {
        // Cartesia accepts 0.6-1.5; anything outside that is clamped here so a
        // bad preference cannot produce an error the user cannot explain.
        speed: clamp(options.speed ?? 1, 0.6, 1.5),
      },
    }),
    // Audio generation can take a while for long answers; if the browser goes
    // away, this is what stops us paying for the rest of the audio.
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    throw await upstreamError(res, 'text-to-speech')
  }

  return res
}

let voiceCache: { at: number; voices: CartesiaVoice[] } | null = null
const VOICE_CACHE_MS = 5 * 60 * 1000

/** Lists the voices available to this API key (public + cloned). */
export async function listVoices(force = false): Promise<CartesiaVoice[]> {
  if (!force && voiceCache && Date.now() - voiceCache.at < VOICE_CACHE_MS) {
    return voiceCache.voices
  }

  const res = await fetch(`${baseUrl()}/voices?limit=100&expand%5B%5D=preview_file_url`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw await upstreamError(res, 'voice list')
  }

  const body = (await res.json()) as {
    data?: Array<{
      id: string
      name?: string
      tagline?: string
      description?: string
      gender?: string | null
      language?: string | null
      is_owner?: boolean
      preview_file_url?: string | null
      preview_url?: string | null
      accents?: Array<{ locale?: string }>
    }>
  }

  const voices: CartesiaVoice[] = (body.data || []).map((voice) => ({
    id: voice.id,
    name: voice.name?.trim() || 'Untitled voice',
    tagline: voice.tagline?.trim() || voice.description?.trim().slice(0, 80) || '',
    gender: voice.gender ?? null,
    language: voice.language ?? voice.accents?.[0]?.locale ?? null,
    previewUrl: voice.preview_file_url ?? voice.preview_url ?? null,
    isOwner: Boolean(voice.is_owner),
  }))

  voiceCache = { at: Date.now(), voices }
  return voices
}

/**
 * Picks the voice to speak with: an explicit request wins, then the
 * environment, then whatever is first on the account. Resolving at request
 * time means a fresh key with no configuration still works.
 */
export async function resolveVoiceId(requested?: string): Promise<string> {
  const explicit = requested?.trim() || process.env.CARTESIA_VOICE_ID?.trim()
  if (explicit) return explicit

  const voices = await listVoices()
  const first = voices.find((voice) => voice.id)
  if (!first) {
    throw new CartesiaError(
      'No Cartesia voice is available on this account. Set CARTESIA_VOICE_ID or create a voice in the Cartesia playground.',
      503
    )
  }
  return first.id
}

/**
 * Transcribes a recorded clip. The batch endpoint decodes the container
 * itself, so the browser can hand us webm/opus straight from MediaRecorder.
 */
export async function transcribeAudio(options: {
  file: Blob
  filename?: string
  language?: string
}): Promise<{ text: string; language: string | null; duration: number | null }> {
  const { file } = options

  if (!file || file.size === 0) {
    throw new CartesiaError('The recording was empty.', 400)
  }
  // 25 MB is well past a spoken question and keeps a bad request cheap.
  if (file.size > 25 * 1024 * 1024) {
    throw new CartesiaError('That recording is too large (limit 25 MB).', 413)
  }

  const form = new FormData()
  form.append('file', file, options.filename || 'query.webm')
  form.append('model', process.env.CARTESIA_STT_MODEL || DEFAULT_STT_MODEL)
  form.append('language', options.language || 'en')

  const res = await fetch(`${baseUrl()}/stt`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    throw await upstreamError(res, 'transcription')
  }

  const body = (await res.json()) as {
    text?: string
    language?: string
    duration?: number
  }

  return {
    text: (body.text || '').trim(),
    language: body.language ?? null,
    duration: typeof body.duration === 'number' ? body.duration : null,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(max, Math.max(min, value))
}
