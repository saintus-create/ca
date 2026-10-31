'use client'

// Thread view composed from Spectrum's ai-assistants components as shipped.
// The store owns threads, messages and the send loop; this file only renders
// them. The answer body itself stays on the existing markdown renderer and
// the corpus citation cards, which Spectrum's plain-text components do not
// cover; everything else here is a packaged component.
import { ChevronDown } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ChatEmptyState } from '@/components/spectrum/ai-assistants/chat-empty-state'
import { ErrorState } from '@/components/spectrum/ai-assistants/error-state'
import { MessageActions } from '@/components/spectrum/ai-assistants/message-actions'
import { PromptComposer } from '@/components/spectrum/ai-assistants/prompt-composer'
import { ReasoningTrace } from '@/components/spectrum/ai-assistants/reasoning-trace'
import { ThinkingDots } from '@/components/spectrum/ai-assistants/thinking-dots'
import { ToolChips } from '@/components/spectrum/ai-assistants/tool-chips'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import { toolLabel } from './types'
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
  const reasoning = message.content.filter(
    (p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning',
  )
  const toolCalls = message.content.filter(
    (p): p is Extract<ChatMessagePart, { type: 'tool-call' }> => p.type === 'tool-call',
  )
  const text = message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')

  if (error) {
    return (
      <ErrorState
        title={error.includes('not set up') ? 'The research service is not set up yet' : 'That search did not finish'}
        message={error}
        retryLabel="Try again"
        onRetry={onRetry}
      />
    )
  }

  return (
    <div className="space-y-3">
      {reasoning.length > 0 && (
        <ReasoningTrace
          steps={reasoning.map((p, i) => ({ id: `${message.id}-reasoning-${i}`, content: p.text }))}
          status={running ? 'thinking' : 'complete'}
        />
      )}
      {toolCalls.length > 0 && (
        <ToolChips
          calls={toolCalls.map((call) => ({
            id: call.toolCallId,
            name: toolLabel(call.toolName),
            args: call.args,
            result: call.result,
            status: call.result !== undefined ? 'success' : running ? 'running' : 'cancelled',
          }))}
        />
      )}
      {text ? (
        <div className="text-[13.5px] leading-[1.7] text-neutral-700 dark:text-neutral-300">
          <MarkdownRenderer content={text} sources={sources} />
        </div>
      ) : running ? (
        <ThinkingDots label="Researching" />
      ) : null}
      {text && !running && (
        <div className="group/message">
          <MessageActions content={text} onRegenerate={onRetry} />
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
  const isEmpty = thread.messages.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex min-h-full flex-col justify-center px-4 py-8 sm:px-6">
            <div className="mx-auto w-full max-w-[560px]">
              <ChatEmptyState
                title="Ask about California law"
                subtitle=""
                prompts={SUGGESTED}
                onSelectPrompt={(prompt) => onSendText(prompt.prompt ?? prompt.label)}
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[560px] space-y-6 px-4 py-5 sm:px-6">
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
        <div className="mx-auto w-full max-w-[560px]">
          <div className="flex items-center gap-2">
            <SidebarTrigger
              aria-label="Threads"
              className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50 lg:hidden"
            />
            <details className="min-w-0 flex-1 text-xs text-neutral-500 dark:text-neutral-400">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3.5 shrink-0" />
                <span className="truncate">{thread.scope ? `Search limited to ${datasets.find((d) => d.code === thread.scope)?.name ?? thread.scope}` : 'Limit search to a specific source (optional)'}</span>
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
          <PromptComposer
            variant="Minimal"
            placeholder={isEmpty ? 'Ask anything about California law' : 'Ask a follow-up'}
            isGenerating={thread.running}
            onSend={(text) => onSendText(text)}
            onStop={onCancel}
            maxLength={20000}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  )
}
