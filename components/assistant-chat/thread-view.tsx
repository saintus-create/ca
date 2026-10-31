'use client'

// Plain React thread view: no assistant-ui runtime. The store owns threads,
// messages and the send loop; this file only renders them and the composer.
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { MessageActions } from '@/components/spectrum/ai-assistants/message-actions'
import { ReasoningTrace } from '@/components/spectrum/ai-assistants/reasoning-trace'
import { ToolChips } from '@/components/spectrum/ai-assistants/tool-chips'
import { ThinkingDots } from '@/components/spectrum/ai-assistants/thinking-dots'
import type { ReasoningStep, ToolCall } from '@/components/spectrum/ai-assistants/types'
import { SpeakButton } from '@/components/speak-button'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import type { DatasetInfo } from '@/components/corpus/datasets'

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
  const reasoningText = message.content
    .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
    .map((p) => p.text)
    .join('\n')
  const toolParts = message.content.filter(
    (p): p is Extract<ChatMessagePart, { type: 'tool-call' }> => p.type === 'tool-call',
  )
  const text = message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')

  const steps: ReasoningStep[] = reasoningText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((content, i) => ({ id: `${message.id}-r-${i}`, content }))

  const calls: ToolCall[] = toolParts.map((call) => ({
    id: call.toolCallId,
    name: call.toolName,
    args: call.args,
    result: call.result,
    status: call.result !== undefined ? 'success' : running ? 'running' : 'success',
  }))

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

  const showThinking = running && !text
  const streamingAnswer = running && !!text

  return (
    <div className="group/message space-y-3">
      {(steps.length > 0 || showThinking) && (
        <ReasoningTrace
          steps={
            steps.length > 0
              ? steps
              : [{ id: `${message.id}-thinking`, content: 'Working through the sources…' }]
          }
          status={showThinking || (running && !text) ? 'thinking' : 'complete'}
          defaultOpen={showThinking}
        />
      )}

      {calls.length > 0 && <ToolChips calls={calls} />}

      {text ? (
        <div className="text-[15px] leading-[1.7] text-neutral-800 dark:text-neutral-200">
          <MarkdownRenderer content={text} streaming={streamingAnswer} sources={sources} />
        </div>
      ) : showThinking && steps.length === 0 ? (
        <ThinkingDots label="Researching" variant="Dots" />
      ) : null}

      {text && !running && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <MessageActions content={text} onRegenerate={onRetry} variant="Ghost" />
          <SpeakButton id={message.id} text={text} />
        </div>
      )}
    </div>
  )
}

export function ThreadView({
  thread,
  datasets: _datasets,
  onSendText,
  onCancel,
  onReload,
  onScopeChange: _onScopeChange,
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
          <div className="flex min-h-full flex-col justify-center px-4 py-6 sm:px-6 sm:py-8">
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
                    className="w-full max-w-full rounded-full border border-black/[0.08] bg-white px-3.5 py-2.5 text-left text-[13px] leading-snug text-neutral-600 shadow-xs transition-colors hover:border-black/[0.14] hover:text-neutral-900 sm:w-auto sm:px-4 sm:text-sm dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-300 dark:hover:border-white/[0.16] dark:hover:text-neutral-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 py-5 pb-28 sm:px-6 sm:pb-8">
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
            className="flex min-w-0 items-end gap-2 rounded-2xl border border-black/[0.08] bg-white p-2 shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-black/[0.16] focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:focus-within:border-white/[0.2] dark:focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]"
          >
            <SidebarTrigger
              aria-label="Threads"
              className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50 lg:hidden"
            />
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask about California law"
              aria-label="Message"
              className="max-h-40 min-h-[40px] w-full flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-relaxed text-neutral-900 outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
            />
            {thread.running ? (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Stop"
                className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity hover:opacity-90"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-95 disabled:opacity-35"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
