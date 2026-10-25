'use client'

// The conversation, built on assistant-ui.
//
// The screen owns its data (messages, sources, errors, running state) and hands
// it to `useExternalStoreRuntime`; everything visible is an assistant-ui
// primitive: the thread and its viewport, the message list, each message's
// parts and actions, and the composer. Voice is wired as adapters on the
// runtime, so `ActionBarPrimitive.Speak` streams Cartesia Sonic and
// `ComposerPrimitive.Dictate` feeds the composer from the microphone.

import { useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useThreadViewport,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { ArrowDown, ArrowUp, PanelLeft, Square } from 'lucide-react'
import { toast } from 'sonner'
import { groupDatasets, type DatasetInfo } from '@/components/corpus/datasets'
import { readVoicePreference } from '@/hooks/use-voice-preference'
import { createDictationAdapter } from '@/lib/voice/dictation-adapter'
import { createChatSpeechAdapter } from '@/lib/voice/speech-adapter'
import { AssistantMessage, EditComposer, UserMessage } from './messages'
import { DictateButton, DictationStatus, VoiceSettings } from './voice-controls'
import type { ChatMessage, ChatMessagePart, ChatThread } from './types'

const SUGGESTED = [
  {
    id: 'deposit',
    label: 'How many days does a landlord have to return a security deposit?',
    prompt: 'How many days does a landlord have to return a security deposit after a tenant moves out?',
  },
  {
    id: 'limitations',
    label: 'Statute of limitations for a written contract?',
    prompt: 'What is the statute of limitations for breach of a written contract in California?',
  },
  {
    id: 'car-search',
    label: 'When can an officer search a car without a warrant?',
    prompt: 'When can an officer search a car without a warrant?',
  },
]

/** What the deployment can do, fetched once by the chat from /api/voice/status. */
export type VoiceAvailability = {
  /** Cartesia Sonic is configured, so Listen streams it. */
  cartesia: boolean
  /** A voice can be used at all (Cartesia, or the browser's own). */
  speech: boolean
  /** The microphone can be used (browser recogniser, or Cartesia Ink). */
  dictation: boolean
}

export const NO_VOICE: VoiceAvailability = { cartesia: false, speech: false, dictation: false }

type LikePart = Exclude<ThreadMessageLike['content'], string> extends readonly (infer P)[] ? P : never
type LikeToolCall = Extract<LikePart, { type: 'tool-call' }>

function convertPart(part: ChatMessagePart): LikePart {
  if (part.type === 'tool-call') {
    return {
      type: 'tool-call',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: part.args as unknown as LikeToolCall['args'],
      argsText: JSON.stringify(part.args),
      result: part.result,
    }
  }
  return part
}

function messageText(message: ChatMessage): string {
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/** Text out of an assistant-ui append/edit payload (string or parts). */
function appendText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => (part as { type?: string })?.type === 'text')
    .map((part) => (part as { text?: string }).text ?? '')
    .join('')
}

type ThreadViewProps = {
  thread: ChatThread
  datasets: DatasetInfo[]
  voice: VoiceAvailability
  onSendText: (text: string) => void
  onCancel: () => void
  onReload: (parentId?: string | null) => void
  onEdit: (parentId: string | null, text: string) => void
  onScopeChange: (scope: string) => void
  onSetMessages: (messages: readonly ChatMessage[]) => void
  onOpenMobileNav: () => void
}

/** A "jump to the newest answer" button, shown only when scrolled away. */
function ScrollToBottom() {
  const isAtBottom = useThreadViewport((viewport) => viewport.isAtBottom)
  if (isAtBottom) return null
  return (
    <div className="pointer-events-none sticky bottom-2 flex justify-center">
      <ThreadPrimitive.ScrollToBottom
        aria-label="Scroll to the newest answer"
        className="pointer-events-auto grid size-8 place-items-center rounded-full border border-black/[0.08] bg-white text-neutral-500 shadow-xs transition-colors hover:text-neutral-900 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-400 dark:hover:text-neutral-50"
      >
        <ArrowDown className="size-4" />
      </ThreadPrimitive.ScrollToBottom>
    </div>
  )
}

export function ThreadView({
  thread,
  datasets,
  voice,
  onSendText,
  onCancel,
  onReload,
  onEdit,
  onScopeChange,
  onSetMessages,
  onOpenMobileNav,
}: ThreadViewProps) {
  // Built once per configuration: the adapters read the chosen voice when a
  // Listen button is pressed, so changing it does not rebuild the runtime.
  const speech = useMemo(
    () =>
      voice.speech
        ? createChatSpeechAdapter({
            configured: voice.cartesia,
            getPreference: readVoicePreference,
            onError: (message) => toast.error(message),
          })
        : undefined,
    [voice.speech, voice.cartesia],
  )

  const dictation = useMemo(
    () =>
      voice.dictation
        ? createDictationAdapter({
            serverTranscription: voice.cartesia,
            onError: (message) => toast.error(message),
          })
        : undefined,
    [voice.dictation, voice.cartesia],
  )

  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages: thread.messages,
    isRunning: thread.running,
    adapters: { speech, dictation },
    onNew: async (message) => {
      const text = appendText(message.content)
      if (text.trim()) onSendText(text)
    },
    onEdit: async (message) => {
      const text = appendText(message.content)
      if (text.trim()) onEdit(message.parentId, text)
    },
    onCancel: async () => {
      onCancel()
    },
    onReload: async (parentId) => {
      onReload(parentId)
    },
    setMessages: (messages) => {
      onSetMessages(messages)
    },
    convertMessage: (message, index): ThreadMessageLike => {
      const error = thread.errors[message.id]
      // Only the tail assistant message can be the one this run is producing;
      // earlier answers stay settled while a new question runs.
      const isTail = index === thread.messages.length - 1
      return {
        id: message.id,
        role: message.role,
        createdAt: message.createdAt,
        content: message.content.map(convertPart),
        ...(message.role === 'assistant'
          ? {
              status: error
                ? ({ type: 'incomplete', reason: 'error', error } as const)
                : thread.running && isTail
                  ? ({ type: 'running' } as const)
                  : ({ type: 'complete', reason: 'stop' } as const),
              metadata: {
                custom: {
                  sources: thread.sources[message.id] ?? [],
                  ...(error ? { error } : {}),
                },
              },
            }
          : {}),
      }
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="relative min-h-0 flex-1 overflow-y-auto">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className="flex h-full flex-col justify-center px-4">
              <div className="mx-auto w-full max-w-[560px] space-y-6">
                <h2 className="text-left text-[28px] font-medium leading-tight tracking-[-0.5px] text-neutral-900 dark:text-neutral-50">
                  Ask about California law
                </h2>
                <div className="flex flex-wrap justify-start gap-2">
                  {SUGGESTED.map((suggestion) => (
                    <ThreadPrimitive.Suggestion
                      key={suggestion.id}
                      prompt={suggestion.prompt}
                      send
                      className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-left text-sm text-neutral-600 shadow-xs transition-colors hover:text-neutral-900 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-300 dark:hover:text-neutral-50"
                    >
                      {suggestion.label}
                    </ThreadPrimitive.Suggestion>
                  ))}
                </div>
              </div>
            </div>
          </AuiIf>

          <AuiIf condition={(state) => !state.thread.isEmpty}>
            <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 py-5 sm:px-6">
              <ThreadPrimitive.Messages
                components={{ UserMessage, AssistantMessage, EditComposer }}
              />
            </div>
          </AuiIf>

          <ScrollToBottom />
        </ThreadPrimitive.Viewport>

        <div className="shrink-0 px-4 pb-4 sm:px-6">
          <div className="mx-auto w-full max-w-[760px]">
            <ComposerPrimitive.Root className="rounded-2xl border border-black/[0.08] bg-white shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
              <div className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-3.5 py-2 dark:border-white/[0.07]">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenMobileNav}
                    aria-label="Threads"
                    className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50 lg:hidden"
                  >
                    <PanelLeft className="size-4" />
                  </button>
                  <label
                    htmlFor="corpus-scope"
                    className="shrink-0 whitespace-nowrap text-[12.5px] text-neutral-500 dark:text-neutral-400"
                  >
                    Search in
                  </label>
                  <select
                    id="corpus-scope"
                    value={thread.scope}
                    onChange={(event) => onScopeChange(event.target.value)}
                    className="min-w-0 flex-1 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12.5px] text-neutral-700 outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-200"
                  >
                    <option value="">All California law</option>
                    {groupDatasets(datasets).map(({ group, items }) => (
                      <optgroup key={group} label={group}>
                        {items.map((dataset) => (
                          <option key={dataset.code} value={dataset.code}>
                            {dataset.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <VoiceSettings configured={voice.cartesia} />
                  <DictateButton available={voice.dictation} />
                </span>
              </div>

              <DictationStatus />

              <ComposerPrimitive.Input
                placeholder="Ask anything about California law"
                className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] text-neutral-900 outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
              />
              <div className="flex justify-end px-3 pb-3 pt-1">
                <AuiIf condition={(state) => !state.thread.isRunning}>
                  <ComposerPrimitive.Send asChild>
                    <button
                      type="button"
                      aria-label="Send"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                  </ComposerPrimitive.Send>
                </AuiIf>
                <AuiIf condition={(state) => state.thread.isRunning}>
                  <ComposerPrimitive.Cancel asChild>
                    <button
                      type="button"
                      aria-label="Stop"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  </ComposerPrimitive.Cancel>
                </AuiIf>
              </div>
            </ComposerPrimitive.Root>
            <p className="mt-2 text-center text-[11.5px] text-neutral-400 dark:text-neutral-500">
              Not legal advice. Answers cite the section they rely on.
            </p>
          </div>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}

/** Re-exported for the store, which needs the same extraction for titles. */
export { messageText }
