'use client'

// Floating voice head: a dot-matrix head that listens, thinks and speaks.
// Browser-native speech only, no provider keys: the microphone comes from
// the Web Speech API and the spoken reply from speech synthesis. A voice
// question goes through the same thread as a typed one, and only the reply
// to a voice question is read aloud.
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatThread } from './types'

type RecognitionResult = {
  isFinal: boolean
  0: { transcript: string }
}

type RecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<RecognitionResult>; resultIndex: number }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => RecognitionInstance

function getRecognitionConstructor(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** Strip markdown formatting so the spoken reply sounds like sentences. */
function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ' '))
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function assistantText(message: ChatMessage, errors: Record<string, string>): { text: string; error?: string } {
  const text = message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
  return { text, error: errors[message.id] }
}

type HeadState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'unsupported' | 'error'

const DOT_KEYFRAMES = `
@keyframes head-pulse { 0%, 100% { opacity: 0.55; transform: scale(0.9) } 50% { opacity: 1; transform: scale(1) } }
@keyframes head-wave { 0%, 100% { transform: translateY(0); opacity: 0.6 } 50% { transform: translateY(-3px); opacity: 1 } }
`

function DotHead({ state }: { state: HeadState }) {
  const dots: Array<{ x: number; y: number; d: number }> = []
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4)
      if (d <= 3.6) dots.push({ x, y, d })
    }
  }
  const color =
    state === 'listening' || state === 'speaking'
      ? 'bg-brand'
      : state === 'thinking'
        ? 'bg-[#8a6d1a] dark:bg-[#d3ab55]'
        : 'bg-neutral-300 dark:bg-neutral-600'
  const duration =
    state === 'idle' || state === 'unsupported'
      ? '3s'
      : state === 'listening'
        ? '1.2s'
        : state === 'thinking'
          ? '1.6s'
          : '0.9s'
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DOT_KEYFRAMES }} />
      <div className="grid grid-cols-9 gap-[3px]" aria-hidden>
        {dots.map(({ x, y, d }) => {
          const delay =
            state === 'speaking'
              ? `${x * 90}ms`
              : state === 'thinking'
                ? `${Math.round(d * 160)}ms`
                : '0ms'
          const animation =
            state === 'idle' || state === 'unsupported'
              ? `head-pulse ${duration} ease-in-out infinite`
              : `head-wave ${duration} ease-in-out ${delay} infinite`
          return (
            <span
              key={`${x}-${y}`}
              className={`size-[5px] rounded-full ${color}`}
              style={{ animation }}
            />
          )
        })}
      </div>
    </>
  )
}

export function VoiceHead({
  thread,
  onSendText,
  onCancel,
}: {
  thread: ChatThread
  onSendText: (text: string) => void
  onCancel: () => void
}) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [note, setNote] = useState('')
  const [voiceAsked, setVoiceAsked] = useState(false)
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const prevRunningRef = useRef(false)
  const voiceThreadIdRef = useRef('')
  const voiceKnownIdsRef = useRef<Set<string>>(new Set())
  const supported = typeof window !== 'undefined' && getRecognitionConstructor() !== null

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
  }

  const startListening = () => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) {
      setNote('Voice is not supported in this browser.')
      return
    }
    setNote('')
    setTranscript('')
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let finalText = ''
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interim += result[0].transcript
      }
      setTranscript((finalText + interim).trim())
      if (finalText.trim()) {
        voiceThreadIdRef.current = thread.id
        voiceKnownIdsRef.current = new Set(
          thread.messages.filter((m) => m.role === 'assistant').map((m) => m.id),
        )
        setVoiceAsked(true)
        onSendText(finalText.trim())
        recognition.stop()
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setNote('Microphone access is blocked. Allow the microphone and try again.')
      }
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  // When a voice run finishes, read the new reply aloud.
  useEffect(() => {
    const wasRunning = prevRunningRef.current
    prevRunningRef.current = thread.running
    if (wasRunning && !thread.running && voiceAsked && thread.id === voiceThreadIdRef.current) {
      setVoiceAsked(false)
      let target: ChatMessage | null = null
      for (let i = thread.messages.length - 1; i >= 0; i--) {
        const m = thread.messages[i]
        if (m.role === 'assistant' && !voiceKnownIdsRef.current.has(m.id)) {
          target = m
          break
        }
      }
      if (!target) return
      const { text, error } = assistantText(target, thread.errors)
      const spoken = stripForSpeech(error || text)
      if (!spoken || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(spoken)
      utterance.lang = 'en-US'
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
      setSpeaking(true)
    }
  }, [thread, voiceAsked])

  // A typed run cancels any speech in progress so it never talks over a new answer.
  useEffect(() => {
    if (thread.running && !voiceAsked) {
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.running])

  useEffect(
    () => () => {
      recognitionRef.current?.abort()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  const state: HeadState = !supported
    ? 'unsupported'
    : listening
      ? 'listening'
      : speaking
        ? 'speaking'
        : thread.running && voiceAsked
          ? 'thinking'
          : note
            ? 'error'
            : 'idle'

  const handleTap = () => {
    if (speaking) {
      stopSpeaking()
      return
    }
    if (listening) {
      stopListening()
      return
    }
    if (thread.running && voiceAsked) {
      onCancel()
      setVoiceAsked(false)
      return
    }
    if (!supported) {
      setNote('Voice is not supported in this browser.')
      return
    }
    startListening()
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-28">
      {state !== 'idle' && (
        <div className="w-64 max-w-[70vw] rounded-2xl border border-black/[0.08] bg-white p-3 text-sm leading-relaxed text-neutral-700 shadow-lg dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-300">
          {state === 'listening' && (transcript || 'Listening…')}
          {state === 'thinking' && 'Researching…'}
          {state === 'speaking' && 'Speaking… Tap the head to stop.'}
          {state === 'unsupported' && 'Voice is not supported in this browser.'}
          {state === 'error' && note}
        </div>
      )}
      <button
        type="button"
        onClick={handleTap}
        aria-label={
          state === 'listening'
            ? 'Stop listening'
            : state === 'speaking'
              ? 'Stop speaking'
              : 'Talk with voice'
        }
        title="Talk with voice"
        className="grid size-20 place-items-center rounded-full border border-black/[0.08] bg-white shadow-lg transition-transform hover:scale-105 dark:border-white/[0.09] dark:bg-[#0B0B0D]"
      >
        <DotHead state={state} />
      </button>
    </div>
  )
}
