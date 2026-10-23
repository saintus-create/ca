'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Check, Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { SPEECH_SPEEDS, useVoicePreference } from '@/hooks/use-voice-preference'

interface Voice {
  id: string
  name: string
  tagline: string
  gender: string | null
  language: string | null
  previewUrl: string | null
}

export function VoicePicker() {
  const { voiceId, setVoiceId, speed, setSpeed } = useVoicePreference()
  const [open, setOpen] = useState(false)
  const [voices, setVoices] = useState<Voice[]>([])
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const previewRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = useCallback(() => {
    const audio = previewRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      previewRef.current = null
    }
    setPreviewing(null)
  }, [])

  const loadVoices = useCallback(async (refresh = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/voice/voices${refresh ? '?refresh=1' : ''}`)
      const data = (await res.json().catch(() => ({}))) as {
        voices?: Voice[]
        defaultVoiceId?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Could not load voices.')
      setVoices(data.voices || [])
      setDefaultVoiceId(data.defaultVoiceId ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load voices.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && voices.length === 0 && !error) {
      void loadVoices()
    }
  }, [open, voices.length, error, loadVoices])

  useEffect(() => {
    return () => {
      previewRef.current?.pause()
    }
  }, [])

  const selectedId = voiceId || defaultVoiceId
  const selected = voices.find((voice) => voice.id === selectedId)

  const togglePreview = (voice: Voice) => {
    if (previewing === voice.id) {
      stopPreview()
      return
    }

    stopPreview()
    const audio = new Audio(`/api/voice/preview?voiceId=${encodeURIComponent(voice.id)}`)
    previewRef.current = audio
    setPreviewing(voice.id)
    audio.onended = () => setPreviewing(null)
    audio.onerror = () => setPreviewing(null)
    void audio.play().catch(() => setPreviewing(null))
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) stopPreview()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ui-control flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          aria-label="Choose the voice used to read answers aloud"
        >
          <AudioLines className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="hidden max-w-[9rem] truncate sm:inline">
            {selected ? selected.name : 'Voice'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="ui-label">Reading voice</span>
          <button
            type="button"
            onClick={() => void loadVoices(true)}
            disabled={isLoading}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Refresh voices"
            aria-label="Refresh voice list"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {isLoading && voices.length === 0 && (
            <div className="flex items-center gap-2 px-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ui-caption">Loading voices…</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="px-2 py-6">
              <p className="ui-caption text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && voices.length === 0 && (
            <p className="ui-caption px-2 py-6">No voices are available on this Cartesia account.</p>
          )}

          {voices.map((voice) => {
            const isSelected = voice.id === selectedId
            return (
              <div
                key={voice.id}
                className={cn(
                  'group flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted',
                  isSelected && 'bg-muted/60'
                )}
              >
                <button
                  type="button"
                  onClick={() => setVoiceId(voice.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="ui-subtitle truncate">{voice.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" />}
                  </div>
                  {voice.tagline && (
                    <p className="ui-caption truncate">{voice.tagline}</p>
                  )}
                </button>

                {voice.previewUrl && (
                  <button
                    type="button"
                    onClick={() => togglePreview(voice)}
                    className="mt-0.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    title={previewing === voice.id ? 'Stop preview' : 'Play preview'}
                    aria-label={previewing === voice.id ? `Stop preview of ${voice.name}` : `Preview ${voice.name}`}
                  >
                    {previewing === voice.id ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
          <span className="ui-caption">Speed</span>
          <div className="flex items-center gap-1" role="group" aria-label="Reading speed">
            {SPEECH_SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                aria-pressed={speed === value}
                className={cn(
                  'ui-caption rounded px-2 py-1 tabular-nums transition-colors',
                  speed === value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
