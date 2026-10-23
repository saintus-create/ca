'use client'

import { useEffect } from 'react'
import { Loader2, Square, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSpeechController } from '@/components/speech-provider'
import { useVoicePreference } from '@/hooks/use-voice-preference'

interface SpeakButtonProps {
  /** Stable identity for this utterance, usually the message id. */
  id: string
  /** Markdown answer to read aloud. */
  text: string
  className?: string
}

export function SpeakButton({ id, text, className }: SpeakButtonProps) {
  const { speak, stop, status, activeId, error, dismissError } = useSpeechController()
  const { voiceId, speed } = useVoicePreference()

  const isActive = activeId === id
  const isBusy = isActive && status !== 'idle'

  useEffect(() => {
    if (error) {
      toast.error(error.message)
      dismissError()
    }
  }, [error, dismissError])

  return (
    <button
      type="button"
      onClick={() => {
        if (isBusy) {
          stop()
        } else {
          void speak(text, id, { voiceId, speed })
        }
      }}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        isBusy && 'bg-muted text-foreground',
        className
      )}
      title={isBusy ? 'Stop reading' : 'Read aloud'}
      aria-label={isBusy ? 'Stop reading aloud' : 'Read answer aloud'}
      aria-pressed={isBusy}
    >
      {isActive && status === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isActive && status === 'playing' ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
