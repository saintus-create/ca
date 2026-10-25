'use client'

// Plain React thread view: no assistant-ui runtime. The store owns threads,
// messages and the send loop; this file only renders them and the composer.
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ThinkingDots } from './thinking-dots'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import { groupDatasets, type DatasetInfo } from '@/components/corpus/datasets'

const SUGGESTED = [
  {
    id: 'deposit',
    label: 'Security deposits',
    prompt: 'How many days does a landlord have to return a security deposit after a tenant moves out?',
  },
  {
    id: 'limitations',
    label: 'Contract deadlines',
    prompt: 'What is the statute of limitations for breach of a written contract in California?',
  },
  {
    id: 'car-search',
    label: 'Warrantless car searches',
    prompt: 'When can an officer search a car without a warrant?',
  },
]

type ThreadViewProps = {
  thread: ChatThread
  datasets: DatasetInfo[]
  onSendText: (text: string) => void
  onCancel: () => void
  onReload: () => void
  onScopeChange: (scope: string) => void
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
}: ThreadViewProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [input])

  const submit = () => {
    const text = input.trim()
    if (!text || thread.running) return
    onSendText(text)
    setInput('')
  }

  const isEmpty = thread.messages.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex min-h-full flex-col justify-center px-4 py-8 sm:px-6">
            <div className="mx-auto w-full max-w-[560px] space-y-5 sm:space-y-6">
              <h2 className="text-left text-[25px] font-medium leading-tight tracking-[-0.5px] text-neutral-900 dark:text-neutral-50 sm:text-[28px]">
                Ask about California law
              </h2>
              <div className="flex flex-wrap justify-start gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSendText(s.prompt)}
                    className="max-w-full rounded-full border border-black/[0.08] bg-white px-3 py-2 text-left text-[13px] leading-snug text-neutral-600 shadow-xs transition-colors hover:text-neutral-900 sm:px-4 sm:py-2 sm:text-sm dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-300 dark:hover:text-neutral-50"
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
      </div>

      <div className="shrink-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
        <div className="mx-auto w-full max-w-[760px]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="min-w-0 rounded-2xl border border-black/[0.08] bg-white shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]"
          >
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.07] sm:px-3.5">
              <SidebarTrigger
                aria-label="Threads"
                className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50 lg:hidden"
              />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {thread.scope ? 'Specific source selected' : 'AI searches all California law'}
              </span>
            </div>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={isEmpty ? 'Ask anything about California law' : 'Ask a follow-up'}
              className="block max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 text-base leading-relaxed text-neutral-900 outline-hidden placeholder:text-neutral-400 sm:px-4 dark:text-neutral-100"
            />
            <div className="flex justify-end px-3 pb-3 pt-1">
              {thread.running ? (
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Stop"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
          </form>
          <details className="mt-2 px-1 text-xs text-neutral-500 dark:text-neutral-400">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3.5" />
              <span>{thread.scope ? `Search limited to ${datasets.find((d) => d.code === thread.scope)?.name ?? thread.scope}` : 'Limit search to a specific source (optional)'}</span>
            </summary>
            <label htmlFor="corpus-scope" className="sr-only">Limit search to a specific source</label>
            <select
              id="corpus-scope"
              value={thread.scope}
              onChange={(e) => onScopeChange(e.target.value)}
              className="mb-2 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-neutral-700 outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-200"
            >
              <option value="">All California law (recommended)</option>
              {groupDatasets(datasets).map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </details>
        </div>
      </div>
    </div>
  )
}
