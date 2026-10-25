'use client'

// The two message views, built out of assistant-ui's message primitives.
//
// Using `MessagePrimitive.*` + `ActionBarPrimitive.*` rather than hand-rolled
// markup is what makes the message actions behave correctly: Copy knows when it
// has copied, Reload is disabled mid-run, Listen only appears when a speech
// adapter is mounted, Stop only while that message is playing, and Edit opens
// the composer scoped to the message being edited.

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react'
import { Check, Copy, Pencil, RotateCcw, Square, Volume2 } from 'lucide-react'
import {
  AssistantTextPart,
  EmptyPart,
  ReasoningPart,
  ToolCallPart,
  UserTextPart,
} from './message-parts'

const ACTION =
  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50'

const MESSAGE_COMPONENTS = {
  Text: AssistantTextPart,
  Reasoning: ReasoningPart,
  tools: { Fallback: ToolCallPart },
  Empty: EmptyPart,
}

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
        <MessagePrimitive.Parts components={{ Text: UserTextPart }} />
      </div>
      <ActionBarPrimitive.Root className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <ActionBarPrimitive.Edit asChild>
          <button type="button" className={ACTION} aria-label="Edit question">
            <Pencil className="size-3.5" />
            Edit
          </button>
        </ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="space-y-3">
      <MessagePrimitive.Parts components={MESSAGE_COMPONENTS} />

      <MessagePrimitive.Error>
        <ErrorCard />
      </MessagePrimitive.Error>

      <ActionBarPrimitive.Root
        hideWhenRunning
        className="flex flex-wrap items-center gap-1"
        aria-label="Answer actions"
      >
        <ActionBarPrimitive.Copy asChild>
          <button type="button" className={ACTION}>
            <AuiIf condition={(state) => state.message.isCopied}>
              <Check className="size-3.5" />
              Copied
            </AuiIf>
            <AuiIf condition={(state) => !state.message.isCopied}>
              <Copy className="size-3.5" />
              Copy
            </AuiIf>
          </button>
        </ActionBarPrimitive.Copy>

        <ActionBarPrimitive.Reload asChild>
          <button type="button" className={ACTION}>
            <RotateCcw className="size-3.5" />
            Regenerate
          </button>
        </ActionBarPrimitive.Reload>

        {/* Listen and Stop are alternatives: the button in the ear of the
            visitor is the one that matches what the answer is doing. */}
        <AuiIf condition={(state) => state.message.speech == null}>
          <ActionBarPrimitive.Speak asChild>
            <button type="button" className={ACTION} aria-label="Listen to this answer">
              <Volume2 className="size-3.5" />
              Listen
            </button>
          </ActionBarPrimitive.Speak>
        </AuiIf>

        <AuiIf condition={(state) => state.message.speech != null}>
          <ActionBarPrimitive.StopSpeaking asChild>
            <button type="button" className={ACTION} aria-label="Stop reading">
              <Square className="size-3.5 fill-current" />
              Stop reading
            </button>
          </ActionBarPrimitive.StopSpeaking>
        </AuiIf>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

/**
 * A failed answer, drawn where the answer would have been. The runtime only
 * renders this when the message settled as `incomplete / error`, which the
 * store sets from the stream's error frame or a failed request.
 */
function ErrorCard() {
  const error = useAuiState((state) =>
    state.message.status?.type === 'incomplete' ? state.message.status.error : undefined,
  )
  const message =
    typeof error === 'string' ? error : 'Sorry, an error occurred while searching. Please try again.'
  const setupProblem = /not set up|API_KEY|not configured/i.test(message)

  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-4 shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
      <p className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-50">
        {setupProblem ? 'The research service is not set up yet' : 'That search did not finish'}
      </p>
      <p className="text-[13.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">{message}</p>
      <ActionBarPrimitive.Reload asChild>
        <button
          type="button"
          className="rounded-full bg-brand px-4 py-1.5 text-[13px] text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </ActionBarPrimitive.Reload>
    </div>
  )
}

/**
 * The composer assistant-ui shows in place of a message being edited: saving
 * re-asks the thread from that point, so the answer below it is replaced.
 */
export function EditComposer() {
  return (
    <ComposerPrimitive.Root className="rounded-2xl border border-black/[0.08] bg-white p-3 shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
      <ComposerPrimitive.Input
        autoFocus
        aria-label="Edit your question"
        className="w-full resize-none bg-transparent text-[13.5px] text-neutral-900 outline-hidden dark:text-neutral-100"
      />
      <div className="mt-2 flex justify-end gap-2">
        <ComposerPrimitive.Cancel asChild>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-[12.5px] text-neutral-500 hover:bg-black/[0.04] dark:text-neutral-400 dark:hover:bg-white/[0.06]"
          >
            Cancel
          </button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <button
            type="button"
            className="rounded-full bg-brand px-3 py-1 text-[12.5px] text-white hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  )
}
