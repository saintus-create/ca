// Playing the MP3 that `/api/voice/tts` returns.
//
// Cartesia streams audio as it is generated, so playback should start on the
// first sentence rather than after the whole answer. Where MediaSource can
// carry `audio/mpeg` (Chrome, Edge, Firefox) bytes are appended to a
// SourceBuffer as they arrive; Safari gets the same stream buffered into a blob
// first. Either way the API key stays on the server.
//
// Framework-free (no React) so the speech adapter can use it directly and the
// tests can exercise it without a component tree.

export const SPEECH_MIME = 'audio/mpeg'

export function canStreamAudio(): boolean {
  if (typeof window === 'undefined' || typeof MediaSource === 'undefined') return false
  try {
    return MediaSource.isTypeSupported(SPEECH_MIME)
  } catch {
    return false
  }
}

type PlayOptions = {
  signal: AbortSignal
  /** Called once the element has actually started producing sound. */
  onPlaying?: () => void
}

/**
 * Attaches a TTS response to an <audio> element and starts it.
 *
 * Resolves when the audio has finished playing. Rejects with the abort reason
 * when `signal` fires, and with a decode/network error otherwise.
 */
export function playSpeech(response: Response, audio: HTMLAudioElement, options: PlayOptions): Promise<void> {
  if (canStreamAudio() && response.body) {
    return playStreaming(response.body, audio, options)
  }
  return playBuffered(response, audio, options)
}

async function playBuffered(response: Response, audio: HTMLAudioElement, options: PlayOptions): Promise<void> {
  const buffer = await response.arrayBuffer()
  if (options.signal.aborted) throw abortError()

  const url = URL.createObjectURL(new Blob([buffer], { type: SPEECH_MIME }))
  audio.src = url
  try {
    await audio.play()
    options.onPlaying?.()
    await waitForEnd(audio, options.signal)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Appends an MP3 stream to a MediaSource-backed element.
 *
 * A SourceBuffer takes one append at a time, so chunks are queued while
 * `updating` is true and drained from `updateend`. The promise settles when the
 * element reports it has played to the end.
 */
function playStreaming(
  body: ReadableStream<Uint8Array>,
  audio: HTMLAudioElement,
  { signal, onPlaying }: PlayOptions,
): Promise<void> {
  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  audio.src = objectUrl

  return new Promise<void>((resolve, reject) => {
    let sourceBuffer: SourceBuffer | null = null
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    const queue: Uint8Array[] = []
    let reading = true
    let settled = false

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onElementError)
      void reader?.cancel().catch(() => {})
      URL.revokeObjectURL(objectUrl)
    }

    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    const fail = (reason: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(reason instanceof Error ? reason : new Error('Audio stream failed.'))
    }

    function onAbort() {
      fail(abortError())
    }

    function onEnded() {
      finish()
    }

    function onElementError() {
      fail(new Error('Audio element error.'))
    }

    const drain = () => {
      if (!sourceBuffer || settled) return
      if (sourceBuffer.updating) return

      if (queue.length) {
        try {
          sourceBuffer.appendBuffer(queue.shift() as Uint8Array)
        } catch (error) {
          fail(error)
        }
        return
      }
      if (!reading && mediaSource.readyState === 'open') {
        try {
          mediaSource.endOfStream()
        } catch {
          // The element may have closed the media source already.
        }
      }
    }

    signal.addEventListener('abort', onAbort, { once: true })
    audio.addEventListener('ended', onEnded, { once: true })
    audio.addEventListener('error', onElementError, { once: true })

    mediaSource.addEventListener(
      'sourceopen',
      () => {
        if (settled) return
        try {
          sourceBuffer = mediaSource.addSourceBuffer(SPEECH_MIME)
          sourceBuffer.addEventListener('updateend', drain)
          sourceBuffer.addEventListener('error', () => fail(new Error('Audio decode failed.')))
        } catch (error) {
          fail(error)
          return
        }

        // Playback was started from a click, so autoplay is allowed. The
        // element simply waits until enough audio has been appended.
        audio
          .play()
          .then(() => onPlaying?.())
          .catch(() => {
            // Autoplay blocked: the sound starts on the visitor's next gesture.
          })

        reader = body.getReader()
        void (async () => {
          try {
            for (;;) {
              const { done, value } = await reader!.read()
              if (settled) return
              if (done) break
              if (value?.byteLength) {
                queue.push(value)
                drain()
              }
            }
            reading = false
            drain()
          } catch (error) {
            if (signal.aborted) return
            fail(error)
          }
        })()
      },
      { once: true },
    )
  })
}

function waitForEnd(audio: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
    function onAbort() {
      cleanup()
      reject(abortError())
    }
    function onEnded() {
      cleanup()
      resolve()
    }
    function onError() {
      cleanup()
      reject(new Error('Audio element error.'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    audio.addEventListener('ended', onEnded, { once: true })
    audio.addEventListener('error', onError, { once: true })
  })
}

function abortError(): Error {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

/** True for the error a cancelled fetch/playback throws, which is not a failure. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
