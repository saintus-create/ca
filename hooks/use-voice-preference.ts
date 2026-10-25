'use client'

// Voice preference shared by every speak button and the picker.
//
// Stored in localStorage (it is a display preference, not a secret) and
// fanned out through a custom event so a change in the header updates the
// buttons inside the conversation without a context provider wrapping the app.

import { useCallback, useEffect, useState } from 'react'

const VOICE_KEY = 'cartesia_voice_id'
const SPEED_KEY = 'cartesia_speed'
const CHANGE_EVENT = 'cartesia-voice-change'

export const SPEECH_SPEEDS = [0.75, 1, 1.25, 1.5] as const

function readVoice(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(VOICE_KEY)
}

function readSpeed(): number {
  if (typeof window === 'undefined') return 1
  const raw = Number(window.localStorage.getItem(SPEED_KEY))
  return SPEECH_SPEEDS.includes(raw as (typeof SPEECH_SPEEDS)[number]) ? raw : 1
}

/**
 * The preference as a plain value, for code outside React (the speech adapter
 * reads it at the moment a Listen button is pressed, so a voice picked in the
 * header applies to the next answer without re-mounting the thread runtime).
 */
export function readVoicePreference(): { voiceId: string | null; speed: number } {
  return { voiceId: readVoice(), speed: readSpeed() }
}

export function useVoicePreference() {
  const [voiceId, setVoiceIdState] = useState<string | null>(null)
  const [speed, setSpeedState] = useState<number>(1)

  useEffect(() => {
    setVoiceIdState(readVoice())
    setSpeedState(readSpeed())

    const sync = () => {
      setVoiceIdState(readVoice())
      setSpeedState(readSpeed())
    }

    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setVoiceId = useCallback((id: string | null) => {
    if (id) window.localStorage.setItem(VOICE_KEY, id)
    else window.localStorage.removeItem(VOICE_KEY)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const setSpeed = useCallback((value: number) => {
    window.localStorage.setItem(SPEED_KEY, String(value))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { voiceId, setVoiceId, speed, setSpeed }
}
