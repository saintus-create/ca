'use client'

// Reads an answer aloud with Cartesia Sonic.
//
// `/api/voice/tts` streams MP3 as it is generated, so playback should start on
// the first sentence rather than after the whole answer. Where MediaSource can
// carry `audio/mpeg` (Chrome, Edge, Firefox) the bytes are appended as they
// arrive; Safari gets the same stream buffered into a blob first. Either way
// the API key stays on the server.
//
// Only one utterance plays at a time: pressing Listen on a second answer stops
// the first, which is what a reader expects.

import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechStatus = 'idle' | 'loading' | 'playing'

export interface SpeakOptions {
  voiceId?: string | null
  speed?: number
}

interface SpeechError {
  message: string
}

const MIME = 'audio/mpeg'

function canStreamAudio(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof MediaSource === 'undefined') return false
  try {
    return MediaSource.isTypeSupported(MIME)
  } catch {
    return false
  }
}

export function useSpeech() {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<SpeechError | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const teardown = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null

    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    teardown()
    if (!mountedRef.current) return
    setStatus('idle')
    setActiveId(null)
  }, [teardown])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      teardown()
    }
  }, [teardown])

  const speak = useCallback(
    async (text: string, id: string, options: SpeakOptions = {}) => {
      if (!text.trim()) return

      // Same button pressed again: treat it as stop.
      if (activeId === id && (status === 'playing' || status === 'loading')) {
        stop()
        return
      }

      teardown()
      setError(null)
      setActiveId(id)
      setStatus('loading')

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceId: options.voiceId || undefined,
            speed: options.speed ?? 1,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || `Speech request failed (${res.status}).`)
        }

        const audio = new Audio()
        audio.preload = 'auto'
        audio.crossOrigin = 'anonymous'
        audioRef.current = audio

        audio.onended = () => {
          if (!mountedRef.current) return
          setStatus('idle')
          setActiveId(null)
        }
        audio.onerror = () => {
          if (!mountedRef.current) return
          setStatus('idle')
          setActiveId(null)
          setError({ message: 'Audio playback failed in this browser.' })
        }

        if (canStreamAudio() && res.body) {
          await playStreaming(res.body, audio, mountedRef, () => {
            if (mountedRef.current) setStatus('playing')
          })
        } else {
          const buffer = await res.arrayBuffer()
          const url = URL.createObjectURL(new Blob([buffer], { type: MIME }))
          objectUrlRef.current = url
          audio.src = url
          await audio.play()
          if (mountedRef.current) setStatus('playing')
        }
      } catch (err) {
        // An aborted request is a user pressing stop, not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!mountedRef.current) return
        setStatus('idle')
        setActiveId(null)
        setError({ message: err instanceof Error ? err.message : 'Speech failed.' })
      }
    },
    [activeId, status, stop, teardown]
  )

  return {
    status,
    activeId,
    error,
    speak,
    stop,
    dismissError: () => setError(null),
    /** False when the browser cannot play inline audio at all. */
    supported: typeof window === 'undefined' ? true : typeof Audio !== 'undefined',
  }
}

/**
 * Appends an MP3 stream to a MediaSource-backed <audio> element.
 *
 * Source buffers accept one append at a time, so chunks are queued while
 * `updating` is true and drained from the `updateend` handler. Resolves when
 * the stream ends and the media is closed.
 */
async function playStreaming(
  body: ReadableStream<Uint8Array>,
  audio: HTMLAudioElement,
  mountedRef: { current: boolean },
  onPlaying: () => void
): Promise<void> {
  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  audio.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    let sourceBuffer: SourceBuffer | null = null
    const queue: Uint8Array[] = []
    let reading = true
    let failed = false

    const finish = () => {
      URL.revokeObjectURL(objectUrl)
      resolve()
    }

    const fail = (reason: unknown) => {
      if (failed) return
      failed = true
      URL.revokeObjectURL(objectUrl)
      reject(reason instanceof Error ? reason : new Error('Audio stream failed.'))
    }

    const drain = () => {
      if (!sourceBuffer || failed) return

      if (sourceBuffer.updating) return

      if (queue.length) {
        try {
          sourceBuffer.appendBuffer(queue.shift() as Uint8Array)
        } catch (err) {
          fail(err)
        }
        return
      }

      if (!reading) {
        // Everything queued has been appended; close the stream cleanly.
        if (mediaSource.readyState === 'open') {
          try {
            mediaSource.endOfStream()
          } catch {
            // Already ended by the media element.
          }
        }
        finish()
      }
    }

    mediaSource.addEventListener(
      'sourceopen',
      () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer(MIME)
          sourceBuffer.addEventListener('updateend', drain)
          sourceBuffer.addEventListener('error', () => fail(new Error('Audio decode failed.')))
        } catch (err) {
          fail(err)
          return
        }

        // Started from a click, so autoplay is allowed. The element simply
        // waits until enough audio has been appended.
        audio.play().then(onPlaying).catch(() => {
          // Autoplay blocked: playback will resume on the user's next gesture.
        })

        const reader = body.getReader()

        const pump = async (): Promise<void> => {
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (!mountedRef.current) {
                await reader.cancel().catch(() => {})
                return
              }
              if (done) break
              if (value && value.byteLength) {
                queue.push(value)
                drain()
              }
            }
            reading = false
            drain()
          } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
              fail(err)
            }
          }
        }

        void pump()
      },
      { once: true }
    )

    audio.addEventListener('error', () => fail(new Error('Audio element error.')), { once: true })
  })
}
