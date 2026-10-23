'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MicButtonProps {
  /** Called with the transcript once Cartesia Ink has finished. */
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
}

// A spoken question is a sentence or two; past a minute the mic has probably
// been left running by accident.
const MAX_RECORDING_MS = 60_000

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

export function MicButton({ onTranscript, disabled, className }: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const transcribe = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true)
      try {
        const form = new FormData()
        const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        form.append('audio', blob, `query.${extension}`)

        const res = await fetch('/api/voice/stt', { method: 'POST', body: form })
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }

        if (!res.ok) {
          throw new Error(data.error || `Transcription failed (${res.status}).`)
        }

        const text = (data.text || '').trim()
        if (text) {
          onTranscript(text)
        } else {
          toast.error('I could not hear a question in that recording.')
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Transcription failed.')
      } finally {
        setIsTranscribing(false)
      }
    },
    [onTranscript]
  )

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setIsRecording(false)
    releaseStream()
  }, [releaseStream])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('This browser does not support microphone recording.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        if (blob.size > 0) {
          void transcribe(blob)
        }
      }

      recorder.start()
      setIsRecording(true)

      timerRef.current = setTimeout(() => {
        stopRecording()
      }, MAX_RECORDING_MS)
    } catch (err) {
      releaseStream()
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error('Microphone access was blocked. Allow it in your browser to ask by voice.')
      } else if (name === 'NotFoundError') {
        toast.error('No microphone was found.')
      } else {
        toast.error('Could not start recording.')
      }
    }
  }, [releaseStream, stopRecording, transcribe])

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      releaseStream()
    }
  }, [releaseStream])

  const isBusy = isTranscribing

  return (
    <button
      type="button"
      onClick={() => {
        if (isBusy) return
        if (isRecording) stopRecording()
        else void startRecording()
      }}
      disabled={disabled || isBusy}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200',
        isRecording
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      title={isRecording ? 'Stop and transcribe' : 'Ask by voice'}
      aria-label={isRecording ? 'Stop recording and transcribe' : 'Record a question'}
      aria-pressed={isRecording}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  )
}
