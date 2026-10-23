'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSpeech } from '@/hooks/use-speech'

type SpeechController = ReturnType<typeof useSpeech>

const SpeechContext = createContext<SpeechController | null>(null)

/**
 * One player for the whole conversation. Mounted above the chat so that
 * starting a second answer stops the first instead of layering two voices.
 */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const speech = useSpeech()
  return <SpeechContext.Provider value={speech}>{children}</SpeechContext.Provider>
}

export function useSpeechController(): SpeechController {
  const controller = useContext(SpeechContext)
  if (!controller) {
    throw new Error('useSpeechController must be used inside <SpeechProvider>')
  }
  return controller
}
