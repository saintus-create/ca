'use client'

// How one assistant reply is drawn: the markdown answer, the research steps
// behind it, and the tool calls it made.
//
// These are the component slots `MessagePrimitive.Parts` renders into, so each
// one receives just its own part (plus that part's status) and nothing about
// the rest of the message. The sources for the citation markers ride along in
// `metadata.custom`, which is how a message carries app data through the
// runtime without a parallel store.

import { useAuiState } from '@assistant-ui/react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ThinkingDots } from './thinking-dots'
import type { ChatSource } from './types'

// A stable empty array: a selector that returns a fresh [] on every call would
// re-render forever.
const NO_SOURCES: ChatSource[] = []

function useMessageSources(): ChatSource[] {
  return useAuiState(
    (state) => (state.message.metadata.custom['sources'] as ChatSource[] | undefined) ?? NO_SOURCES,
  )
}

// Deliberately loose: every part-status variant in assistant-ui (running,
// complete, incomplete+reason, requires-action) has to fit, and this module
// only ever asks whether the part is still running.
type PartStatus = { type: string; reason?: string; error?: unknown } | undefined

export function AssistantTextPart({ text, status }: { text: string; status?: PartStatus }) {
  const sources = useMessageSources()
  return (
    <div className="text-[13.5px] leading-[1.7] text-neutral-700 dark:text-neutral-300">
      <MarkdownRenderer content={text} sources={sources} streaming={status?.type === 'running'} />
    </div>
  )
}

export function UserTextPart({ text }: { text: string }) {
  return <span className="whitespace-pre-wrap break-words">{text}</span>
}

/** The thinking the model emitted before answering, folded away by default. */
export function ReasoningPart({ text, status }: { text: string; status?: PartStatus }) {
  return (
    <details
      open={status?.type === 'running'}
      className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]"
    >
      <summary className="cursor-pointer text-[13px] text-neutral-500 dark:text-neutral-400">
        Research steps
      </summary>
      <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {text}
      </div>
    </details>
  )
}

/** One tool call: a dot while it runs, a filled dot once its result is in. */
export function ToolCallPart({
  toolName,
  args,
  result,
  status,
}: {
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
  status?: PartStatus
}) {
  const done = result !== undefined || status?.type === 'complete'
  const detail = args && Object.keys(args).length > 0 ? JSON.stringify(args) : undefined
  return (
    <div
      className="flex items-center gap-2 text-[13px] text-neutral-500 dark:text-neutral-400"
      title={detail}
      data-tool={toolName}
    >
      <span className={`size-2 shrink-0 rounded-full ${done ? 'bg-neutral-400' : 'animate-pulse bg-brand'}`} />
      {toolName}
    </div>
  )
}

/** Shown while a reply has nothing readable in it yet (it is still thinking). */
export function EmptyPart() {
  const running = useAuiState((state) => state.message.status?.type === 'running')
  return running ? <ThinkingDots label="Researching" /> : null
}
