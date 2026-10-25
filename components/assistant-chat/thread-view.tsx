'use client'

import { useState } from 'react'
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { ArrowUp, PanelLeft, Square } from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ThinkingDots } from './thinking-dots'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import { groupDatasets, type DatasetInfo } from '@/components/corpus/datasets'

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

type ThreadViewProps = {
  thread: ChatThread
  datasets: DatasetInfo[]
  onSendText: (text: string) => void
  onCancel: () => void
  onReload: () => void
  onScopeChange: (scope: string) => void
  onSetMessages: (messages: readonly ChatMessage[]) => void
  onOpenMobileNav: () => void
}

function UserMessageView({ message }: { message: ChatMessage }) {
  const text = message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
        {text}
      </div>
    </div>
  )
}

function AssistantMessageView({
  message,
  sources,
  error,
  running,
  onRetry,
}: {
  message: ChatMessage
  sources: ChatSource[]
  error?: string
  running: boolean
  onRetry: () => void
}) {
  const [copied, setCopied] = useState(false)
  const reasoning = message.content
    .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
    .map((p) => p.text)
    .join('\n')
  const toolCalls = message.content.filter(
    (p): p is Extract<ChatMessagePart, { type: 'tool-call' }> => p.type === 'tool-call',
  )
  const text = message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-4 shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
        <p className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-50">
          {error.includes('not set up') ? 'The research service is not set up yet' : 'That search did not finish'}
        </p>
        <p className="text-[13.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-brand px-4 py-1.5 text-[13px] text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reasoning && (
        <details
          open={running}
          className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]"
        >
          <summary className="cursor-pointer text-[13px] text-neutral-500 dark:text-neutral-400">
            Research steps
          </summary>
          <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {reasoning}
          </div>
        </details>
      )}
      {toolCalls.map((call) => (
        <div key={call.toolCallId} className="flex items-center gap-2 text-[13px] text-neutral-500 dark:text-neutral-400">
          <span
            className={`size-2 shrink-0 rounded-full ${
              call.result !== undefined
                ? 'bg-neutral-400'
                : 'animate-pulse bg-brand'
            }`}
          />
          {call.toolName}
        </div>
      ))}
      {text ? (
        <div className="text-[13.5px] leading-[1.7] text-neutral-700 dark:text-neutral-300">
          <MarkdownRenderer content={text} sources={sources} />
        </div>
      ) : running ? (
        <ThinkingDots label="Researching" />
      ) : null}
      {text && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              } catch {
                /* clipboard unavailable */
              }
            }}
            className="rounded-full px-3 py-1 text-[12.5px] text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full px-3 py-1 text-[12.5px] text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

export function ThreadView({
  thread,
  datasets,
  onSendText,
  onCancel,
  onReload,
  onScopeChange,
  onSetMessages,
  onOpenMobileNav,
}: ThreadViewProps) {
  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages: thread.messages,
    isRunning: thread.running,
    onNew: async (message) => {
      const content = message.content
      const text =
        typeof content === 'string'
          ? content
          : content
              .filter((p) => (p as { type?: string }).type === 'text')
              .map((p) => (p as { text?: string }).text ?? '')
              .join('')
      if (text.trim()) onSendText(text)
    },
    onCancel: async () => {
      onCancel()
    },
    onReload: async () => {
      onReload()
    },
    setMessages: (messages) => {
      onSetMessages(messages)
    },
    convertMessage: (message) => ({
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      content: message.content.map(convertPart),
    }),
  })

  const isEmpty = thread.messages.length === 0

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex h-full flex-col justify-center px-4">
              <div className="mx-auto w-full max-w-[560px] space-y-6">
                <h2 className="text-left text-[28px] font-medium leading-tight tracking-[-0.5px] text-neutral-900 dark:text-neutral-50">
                  Ask about California law
                </h2>
                <div className="flex flex-wrap justify-start gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSendText(s.prompt)}
                      className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-left text-sm text-neutral-600 shadow-xs transition-colors hover:text-neutral-900 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-300 dark:hover:text-neutral-50"
                    >
                    {s.label}
                  </button>
                ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 py-5 sm:px-6">
              {thread.messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessageView key={message.id} message={message} />
                ) : (
                  <AssistantMessageView
                    key={message.id}
                    message={message}
                    sources={thread.sources[message.id] ?? []}
                    error={thread.errors[message.id]}
                    running={thread.running}
                    onRetry={onReload}
                  />
                ),
              )}
            </div>
          )}
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
                    onChange={(e) => onScopeChange(e.target.value)}
                    className="min-w-0 flex-1 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12.5px] text-neutral-700 outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-200"
                  >
                    <option value="">All California law</option>
                    {groupDatasets(datasets).map(({ group, items }) => (
                      <optgroup key={group} label={group}>
                        {items.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </span>
              </div>
              <ComposerPrimitive.Input
                placeholder={isEmpty ? 'Ask anything about California law' : 'Ask a follow-up'}
                className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] text-neutral-900 outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
              />
              <div className="flex justify-end px-3 pb-3 pt-1">
                {thread.running ? (
                  <ComposerPrimitive.Cancel asChild>
                    <button
                      type="button"
                      aria-label="Stop"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  </ComposerPrimitive.Cancel>
                ) : (
                  <ComposerPrimitive.Send asChild>
                    <button
                      type="button"
                      aria-label="Send"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                  </ComposerPrimitive.Send>
                )}
              </div>
            </ComposerPrimitive.Root>
          </div>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
