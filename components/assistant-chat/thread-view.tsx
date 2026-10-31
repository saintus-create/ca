'use client'

// Thread chrome comes from Spectrum + shadcn only — no parallel hand-rolled UI.
import { SidebarTrigger } from '@/components/ui/sidebar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ChatEmptyState } from '@/components/spectrum/ai-assistants/chat-empty-state'
import { ErrorState } from '@/components/spectrum/ai-assistants/error-state'
import { MessageActions } from '@/components/spectrum/ai-assistants/message-actions'
import { PromptComposer } from '@/components/spectrum/ai-assistants/prompt-composer'
import { ReasoningTrace } from '@/components/spectrum/ai-assistants/reasoning-trace'
import { ThinkingDots } from '@/components/spectrum/ai-assistants/thinking-dots'
import { ToolChips } from '@/components/spectrum/ai-assistants/tool-chips'
import type { ReasoningStep, SuggestedPrompt, ToolCall } from '@/components/spectrum/ai-assistants/types'
import { SpeakButton } from '@/components/speak-button'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import type { DatasetInfo } from '@/components/corpus/datasets'

const SUGGESTED: SuggestedPrompt[] = [
  {
    id: 'deposit',
    label: 'Security deposits',
    prompt:
      'How many days does a landlord have to return a security deposit after a tenant moves out?',
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
      <ErrorState
        title={error.includes('not set up') ? 'The research service is not set up yet' : 'That search did not finish'}
        message={error}
        onRetry={onRetry}
        variant="Card"
      />
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
  const isEmpty = thread.messages.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex min-h-full flex-col justify-center px-4 py-6 sm:px-6 sm:py-8">
            <ChatEmptyState
              className="mx-auto"
              title="Ask about California law"
              subtitle=""
              prompts={SUGGESTED}
              onSelectPrompt={(p) => onSendText(p.prompt || p.label)}
              variant="Default"
            />
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
        <div className="mx-auto flex w-full max-w-[760px] items-end gap-2">
          <SidebarTrigger
            aria-label="Threads"
            className="mb-1 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-50 lg:hidden"
          />
          <PromptComposer
            className="max-w-none flex-1"
            variant="Minimal"
            placeholder="Ask about California law"
            isGenerating={thread.running}
            onSend={(text) => onSendText(text)}
            onStop={onCancel}
            maxLength={8000}
          />
        </div>
      </div>
    </div>
  )
}
