'use client'

// Voice, in the composer.
//
// The microphone is assistant-ui's own dictation primitive, so the transcript
// lands in the composer text the same way typing does, the button knows when a
// session is live, and Escape/blur behave like the rest of the composer. The
// speech side lives on each answer's action bar (see messages.tsx); the picker
// here chooses the Cartesia voice that Listen uses.

import { AuiIf, ComposerPrimitive } from '@assistant-ui/react'
import { Mic, Square } from 'lucide-react'
import { VoicePicker } from '@/components/voice-picker'
import { cn } from '@/lib/utils'

const BUTTON =
  'grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50'

export function DictateButton({ available }: { available: boolean }) {
  if (!available) return null

  return (
    <>
      <AuiIf condition={(state) => state.composer.dictation == null}>
        <ComposerPrimitive.Dictate asChild>
          <button type="button" className={BUTTON} aria-label="Ask by voice" title="Ask by voice">
            <Mic className="size-4" />
          </button>
        </ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf condition={(state) => state.composer.dictation != null}>
        <ComposerPrimitive.StopDictation asChild>
          <button
            type="button"
            className={cn(BUTTON, 'bg-red-500 text-white hover:bg-red-600 hover:text-white')}
            aria-label="Stop and transcribe"
            title="Stop and transcribe"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        </ComposerPrimitive.StopDictation>
      </AuiIf>
    </>
  )
}

/** The strip above the input while the microphone is open. */
export function DictationStatus() {
  return (
    <AuiIf condition={(state) => state.composer.dictation != null}>
      <div
        className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2 text-[12.5px] text-neutral-500 dark:border-white/[0.07] dark:text-neutral-400"
        aria-live="polite"
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-red-500" />
        <span className="shrink-0">Listening</span>
        <ComposerPrimitive.DictationTranscript className="truncate italic" />
      </div>
    </AuiIf>
  )
}

/** The Cartesia voice and speed used by Listen; hidden without a key. */
export function VoiceSettings({ configured }: { configured: boolean }) {
  if (!configured) return null
  return (
    <span className="shrink-0">
      <VoicePicker />
    </span>
  )
}
