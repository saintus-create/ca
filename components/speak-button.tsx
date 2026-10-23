'use client'

import { useEffect, useRef, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { toSpeakableText } from '@/lib/speakable'
import { useVoicePreference } from '@/hooks/use-voice-preference'

interface SpeakButtonProps {
  /** Stable identity for this utterance, usually the message id. */
  id: string
  /** Markdown answer to read aloud. */
  text: string
  className?: string
}

/**
 * Browser-native speech is the default, so reading answers does not depend on
 * a server-side Cartesia key. This also starts playback immediately instead of
 * waiting for a separate audio-generation request.
 */
export function SpeakButton({ id, text, className }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const { speed } = useVoicePreference()

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis?.cancel()
        utteranceRef.current = null
      }
    }
  }, [])

  const toggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Read aloud is not supported by this browser.')
      return
    }

    if (speaking) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      setSpeaking(false)
      return
    }

    const spokenText = toSpeakableText(text, { maxChars: 12000 })
    if (!spokenText) {
      toast.error('There is no readable text in this answer.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(spokenText)
    utterance.rate = Math.min(1.5, Math.max(0.6, speed))
    utterance.lang = 'en-US'
    utterance.onend = () => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeaking(false)
      }
    }
    utterance.onerror = (event) => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeaking(false)
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          toast.error('The browser could not read this answer aloud.')
        }
      }
    }
    utteranceRef.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button
      type="button"
      onClick={toggleSpeech}
      className={cn(
        'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315b9a]/40',
        speaking && 'bg-[#eaf0fa] text-[#002868] dark:bg-blue-950 dark:text-blue-200',
        className
      )}
      title={speaking ? 'Stop reading' : 'Read aloud'}
      aria-label={speaking ? `Stop reading answer ${id}` : `Read answer ${id} aloud`}
      aria-pressed={speaking}
    >
      {speaking ? <Square className="size-4 fill-current" /> : <Volume2 className="size-4" />}
    </button>
  )
}
