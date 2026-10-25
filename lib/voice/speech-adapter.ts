// Cartesia Sonic, exposed to assistant-ui as a `SpeechSynthesisAdapter`.
//
// assistant-ui's `ActionBarPrimitive.Speak` / `StopSpeaking` call
// `runtime.speak(messageId)`, which asks the configured adapter for an
// utterance and then watches its status. Implementing that interface — rather
// than a bespoke "Listen" button — is what makes listening behave like the rest
// of the chat: starting a second answer stops the first, the button knows when
// audio is running, and Stop appears exactly while something is playing.
//
// The browser never sees the Cartesia key: `speak` posts to `/api/voice/tts`
// and streams the MP3 that comes back.
//
// When the deployment has no Cartesia key the caller passes a browser-speech
// fallback, so Listen still works; nothing here degrades silently.

import { WebSpeechSynthesisAdapter, type SpeechSynthesisAdapter } from '@assistant-ui/react'
import { toSpeakableText } from '@/lib/speakable'
import { isAbortError, playSpeech } from './playback'

export type VoicePreference = { voiceId: string | null; speed: number }

export type SpeechAdapterOptions = {
  /** Read when the button is pressed, so a voice change applies immediately. */
  getPreference?: () => VoicePreference
  /** Visitor-facing message for a failed playback (surfaced as a toast). */
  onError?: (message: string) => void
  /** Used instead of Cartesia when the deployment has no key. */
  fallback?: SpeechSynthesisAdapter
  endpoint?: string
}

const DEFAULT_ENDPOINT = '/api/voice/tts'

export function createSpeechAdapter(options: SpeechAdapterOptions = {}): SpeechSynthesisAdapter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const getPreference = options.getPreference ?? (() => ({ voiceId: null, speed: 1 }))
  const report = options.onError ?? (() => {})

  return {
    speak(text: string): SpeechSynthesisAdapter.Utterance {
      if (options.fallback) return options.fallback.speak(text)

      const subscribers = new Set<() => void>()
      const controller = new AbortController()
      const audio = new Audio()
      audio.preload = 'auto'
      audio.crossOrigin = 'anonymous'

      let status: SpeechSynthesisAdapter.Status = { type: 'starting' }
      let settled = false

      const notify = () => {
        for (const callback of subscribers) {
          try {
            callback()
          } catch (error) {
            console.error('[voice] utterance subscriber threw', error)
          }
        }
      }

      const setStatus = (next: SpeechSynthesisAdapter.Status) => {
        if (status.type === 'ended') return
        status = next
        notify()
      }

      const end = (reason: 'finished' | 'cancelled' | 'error', error?: unknown) => {
        if (settled) return
        settled = true
        controller.abort()
        audio.onended = null
        audio.onerror = null
        try {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        } catch {
          // The element may not have a source yet.
        }
        status = { type: 'ended', reason, ...(error !== undefined ? { error } : {}) }
        notify()
      }

      audio.onended = () => end('finished')
      audio.onerror = () => {
        report('Audio playback failed in this browser.')
        end('error', 'audio-element')
      }

      const preference = getPreference()

      void (async () => {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              voiceId: preference.voiceId || undefined,
              speed: preference.speed ?? 1,
            }),
            signal: controller.signal,
          })

          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string }
            throw new Error(body.error || `Speech request failed (${response.status}).`)
          }

          await playSpeech(response, audio, {
            signal: controller.signal,
            onPlaying: () => setStatus({ type: 'running' }),
          })
          end('finished')
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) return
          report(error instanceof Error ? error.message : 'Speech failed.')
          end('error', error instanceof Error ? error.message : 'speech-failed')
        }
      })()

      return {
        get status() {
          return status
        },
        cancel: () => end('cancelled'),
        subscribe: (callback: () => void) => {
          if (status.type === 'ended') {
            // The runtime subscribes right after speak() returns; a failure
            // that beat it there still has to be delivered.
            let cancelled = false
            queueMicrotask(() => {
              if (!cancelled) callback()
            })
            return () => {
              cancelled = true
            }
          }
          subscribers.add(callback)
          return () => subscribers.delete(callback)
        },
      }
    },
  }
}

/**
 * The adapter the chat mounts. Cartesia when the deployment has a key;
 * otherwise the browser's own voice, so Listen still works without one. Returns
 * undefined when neither is available, which turns the Listen button off
 * instead of leaving a button that cannot do anything.
 */
export function createChatSpeechAdapter(config: {
  configured: boolean
  getPreference: () => VoicePreference
  onError: (message: string) => void
}): SpeechSynthesisAdapter | undefined {
  if (config.configured) {
    return createSpeechAdapter({
      getPreference: config.getPreference,
      onError: config.onError,
    })
  }

  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return undefined

  // Browser speech reads the raw text it is given, so markdown is stripped
  // first: nobody wants to hear "asterisk asterisk".
  const browser = new WebSpeechSynthesisAdapter()
  return {
    speak(text: string): SpeechSynthesisAdapter.Utterance {
      return browser.speak(toSpeakableText(text, { maxChars: 12000 }))
    },
  }
}
