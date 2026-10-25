// Speaking a question instead of typing it, exposed to assistant-ui as a
// `DictationAdapter` so `ComposerPrimitive.Dictate` drives it.
//
// Two paths, in this order:
//
//   1. The browser's own recogniser (Chrome, Edge, Safari). It needs no key and
//      returns words while the visitor is still talking, so the composer fills
//      in live.
//   2. Cartesia Ink through `/api/voice/stt`, for browsers without one: the
//      microphone is recorded with MediaRecorder and the clip is transcribed
//      when the visitor stops.
//
// The adapter only reports words; assistant-ui owns the composer text, so the
// transcript lands in the composer and can be edited before sending.

import type { DictationAdapter } from '@assistant-ui/react'

export type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult:
    | ((event: {
        resultIndex?: number
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>
      }) => void)
    | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

export type DictationOptions = {
  /** `/api/voice/stt` by default. */
  endpoint?: string
  /** BCP-47 language for the recogniser and for Ink. */
  language?: string
  /** Visitor-facing message for a failure (surfaced as a toast). */
  onError?: (message: string) => void
  /** Hard stop for a recording that was left running. */
  maxDurationMs?: number
  /** True when the deployment has a Cartesia key, i.e. Ink can transcribe. */
  serverTranscription?: boolean
}

const DEFAULT_ENDPOINT = '/api/voice/stt'
const DEFAULT_MAX_MS = 60_000

/** The recogniser lives on `window` in Chrome, Edge and Safari only. */
export function browserRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return scope.SpeechRecognition || scope.webkitSpeechRecognition
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
}

type SpeechListener = (result: DictationAdapter.Result) => void

/** The three listener lists every session implementation needs. */
function createListeners() {
  const speech = new Set<SpeechListener>()
  const ended = new Set<SpeechListener>()
  const started = new Set<() => void>()
  return {
    emitSpeech(result: DictationAdapter.Result) {
      for (const callback of speech) callback(result)
    },
    emitEnd(result: DictationAdapter.Result) {
      for (const callback of ended) callback(result)
    },
    emitStart() {
      for (const callback of started) callback()
    },
    onSpeech: (callback: SpeechListener) => {
      speech.add(callback)
      return () => speech.delete(callback)
    },
    onSpeechEnd: (callback: SpeechListener) => {
      ended.add(callback)
      return () => ended.delete(callback)
    },
    onSpeechStart: (callback: () => void) => {
      started.add(callback)
      return () => started.delete(callback)
    },
  }
}

export function createDictationAdapter(options: DictationOptions = {}): DictationAdapter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const language = options.language ?? 'en-US'
  const maxMs = options.maxDurationMs ?? DEFAULT_MAX_MS
  const report = options.onError ?? (() => {})
  const serverTranscription = options.serverTranscription ?? true

  return {
    // The visitor is watching their words appear; typing over them is allowed.
    disableInputDuringDictation: false,
    listen(): DictationAdapter.Session {
      const Recogniser = browserRecognitionConstructor()
      if (Recogniser) return listenWithRecognition(Recogniser)
      if (!serverTranscription) throw new Error('Voice input is not available in this browser.')
      return listenWithRecording()
    },
  }

  function listenWithRecognition(Recogniser: SpeechRecognitionConstructor): DictationAdapter.Session {
    const listeners = createListeners()
    const recognition = new Recogniser()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    let status: DictationAdapter.Status = { type: 'starting' }
    let transcript = ''
    let cancelled = false

    recognition.onstart = () => {
      status = { type: 'running' }
      listeners.emitStart()
    }

    recognition.onresult = (event) => {
      const first = event.resultIndex ?? 0
      for (let index = first; index < event.results.length; index++) {
        const result = event.results[index]
        const text = result?.[0]?.transcript?.trim()
        if (!text) continue
        if (result.isFinal) {
          transcript = `${transcript} ${text}`.trim()
          listeners.emitSpeech({ transcript, isFinal: true })
        } else {
          // Interim words are shown but not committed: the session's text is
          // the final part plus whatever is being said right now.
          listeners.emitSpeech({ transcript: `${transcript} ${text}`.trim(), isFinal: false })
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        report('Microphone access was blocked. Allow it in your browser settings.')
      } else if (event.error === 'no-speech') {
        report('I could not hear anything. Try again.')
      } else if (event.error !== 'aborted') {
        report('Voice input failed. Please try again.')
      }
    }

    recognition.onend = () => {
      status = { type: 'ended', reason: cancelled ? 'cancelled' : 'stopped' }
      if (!cancelled) listeners.emitEnd({ transcript, isFinal: true })
    }

    try {
      recognition.start()
    } catch (error) {
      status = { type: 'ended', reason: 'error' }
      report(error instanceof Error ? error.message : 'Voice input could not start.')
      throw error
    }

    return {
      get status() {
        return status
      },
      stop: async () => {
        recognition.stop()
      },
      cancel: () => {
        cancelled = true
        recognition.abort()
        status = { type: 'ended', reason: 'cancelled' }
      },
      onSpeechStart: listeners.onSpeechStart,
      onSpeechEnd: listeners.onSpeechEnd,
      onSpeech: listeners.onSpeech,
    }
  }

  function listenWithRecording(): DictationAdapter.Session {
    const listeners = createListeners()
    const chunks: Blob[] = []

    let status: DictationAdapter.Status = { type: 'starting' }
    let cancelled = false
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const release = () => {
      if (timer) clearTimeout(timer)
      timer = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
    }

    const settle = (reason: 'stopped' | 'cancelled' | 'error', transcript = '') => {
      status = { type: 'ended', reason }
      if (!cancelled) listeners.emitEnd({ transcript, isFinal: true })
    }

    const transcribe = async (blob: Blob): Promise<string> => {
      const form = new FormData()
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('audio', blob, `query.${extension}`)
      form.append('language', language.split('-')[0] ?? 'en')
      const response = await fetch(endpoint, { method: 'POST', body: form })
      const body = (await response.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!response.ok) throw new Error(body.error || `Transcription failed (${response.status}).`)
      return (body.text || '').trim()
    }

    const session: DictationAdapter.Session = {
      get status() {
        return status
      },
      stop: async () => {
        const active = recorder
        if (!active || active.state === 'inactive') {
          release()
          settle('stopped')
          return
        }
        await new Promise<void>((resolve) => {
          active.addEventListener('stop', () => resolve(), { once: true })
          active.stop()
        })
        release()

        const blob = new Blob(chunks, { type: active.mimeType || 'audio/webm' })
        if (blob.size === 0) {
          settle('stopped')
          return
        }
        try {
          const transcript = await transcribe(blob)
          if (cancelled) return
          if (transcript) listeners.emitSpeech({ transcript, isFinal: true })
          settle('stopped', transcript)
        } catch (error) {
          if (cancelled) return
          report(error instanceof Error ? error.message : 'Transcription failed.')
          settle('error')
        }
      },
      cancel: () => {
        cancelled = true
        if (recorder && recorder.state !== 'inactive') recorder.stop()
        release()
        status = { type: 'ended', reason: 'cancelled' }
      },
      onSpeechStart: listeners.onSpeechStart,
      onSpeechEnd: listeners.onSpeechEnd,
      onSpeech: listeners.onSpeech,
    }

    // getUserMedia and the recorder both settle asynchronously; the session is
    // handed back immediately (assistant-ui reads `status` synchronously) and
    // reports `running` once the microphone is actually open.
    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream = media

        const mimeType = pickMimeType()
        const active = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
        recorder = active
        active.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        active.start()

        status = { type: 'running' }
        listeners.emitStart()
        timer = setTimeout(() => {
          void session.stop()
        }, maxMs)
      } catch (error) {
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          report('Microphone access was blocked. Allow it in your browser to ask by voice.')
        } else if (name === 'NotFoundError') {
          report('No microphone was found.')
        } else {
          report('Could not start recording.')
        }
        settle('error')
      }
    })()

    return session
  }
}
