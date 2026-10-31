'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ConversationList, type ConversationEntry } from '@/components/spectrum/ai-assistants/conversation-list'
import { ThreadView } from './thread-view'
import { VoiceHead } from './voice-head'
import type { ChatMessage, ChatMessagePart, ChatSource, ChatThread } from './types'
import { fetchDatasets, type DatasetInfo } from '@/components/corpus/datasets'

const STORAGE_KEY = 'california-law-threads-v1'

const TOOL_LABELS: Record<string, string> = {
  search_california_law: 'California Law',
  web_search: 'Web Search',
  firecrawl_search: 'Web Search',
  firecrawl_scrape: 'Deep Scrape',
  deep_scrape: 'Deep Scrape',
  analyze_content: 'Content Analysis',
}

function toolLabel(tool?: string): string {
  return (tool && TOOL_LABELS[tool]) || 'Research Step'
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function freshThread(): ChatThread {
  return {
    id: newId(),
    title: 'New thread',
    messages: [],
    sources: {},
    errors: {},
    scope: '',
    running: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function threadTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean
}

function parseSearchResults(resultText: string): ChatSource[] {
  const results: ChatSource[] = []
  let current: ChatSource | null = null
  for (const line of resultText.split('\n')) {
    const titleMatch = line.match(/^\[(\d+)\]\s+(.+)$/)
    if (titleMatch) {
      if (current && current.title) results.push(current)
      current = { url: '', title: titleMatch[2].replace(' (scraped)', '') }
      continue
    }
    if (line.startsWith('URL: ') && current) {
      current.url = line.substring(5)
      continue
    }
    if (line.startsWith('Source: ') && current) {
      current.url = line.substring(8).trim()
      continue
    }
    if (line.startsWith('Description: ') && current) {
      current.description = line.substring(13)
      continue
    }
    if (current && !current.description && line.trim().length > 40 && !/^[A-Za-z][A-Za-z ]{0,12}: /.test(line)) {
      current.description = line.trim()
      continue
    }
  }
  if (current && current.title) results.push(current)
  return results
}

function friendlyError(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes('SARVAM_API_KEY') ||
      error.message.includes('ANTHROPIC_API_KEY') ||
      error.message.includes('not configured')
    ) {
      return 'The research service is not set up on this deployment yet. The operator needs to add the language model key before questions can be answered.'
    }
    if (error.message.includes('FIRECRAWL_API_KEY')) {
      return 'Web search is not configured on this deployment. California law search still works.'
    }
    if (error.message.includes('model')) {
      return 'The configured model is not available for this API key.'
    }
    return `Error: ${error.message}`
  }
  return 'Sorry, an error occurred while searching. Please try again.'
}

type ToolCallAcc = { id: string; name: string; args: Record<string, unknown>; result?: string }

function buildParts(reasoning: string, toolCalls: ToolCallAcc[], text: string): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  if (reasoning) parts.push({ type: 'reasoning', text: reasoning })
  for (const tc of toolCalls) {
    parts.push({
      type: 'tool-call',
      toolCallId: tc.id,
      toolName: tc.name,
      args: tc.args,
      ...(tc.result !== undefined ? { result: tc.result } : {}),
    })
  }
  if (text) parts.push({ type: 'text', text })
  return parts
}

function ThreadList({
  threads,
  currentId,
  onSelect,
  onNew,
  onDelete: _onDelete,
}: {
  threads: ChatThread[]
  currentId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const visible = threads.filter((t) => t.messages.length > 0)
  const conversations: ConversationEntry[] = visible.map((t) => ({
    id: t.id,
    title: t.title,
    group: 'Threads',
  }))
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <Button
        type="button"
        variant="outline"
        onClick={onNew}
        className="w-full justify-start gap-2 rounded-full"
      >
        <Plus className="size-4" />
        New thread
      </Button>
      {conversations.length > 0 && (
        <ConversationList
          className="max-w-none flex-1 border-0 bg-transparent p-0 shadow-none"
          conversations={conversations}
          activeId={currentId}
          onSelect={onSelect}
          variant="Compact"
        />
      )}
    </div>
  )
}

export function AssistantChat() {
  const [threads, setThreads] = useState<ChatThread[]>(() => [freshThread()])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loaded, setLoaded] = useState(false)
  const abortRefs = useRef(new Map<string, AbortController>())
  const threadsRef = useRef(threads)

  const current = threads.find((t) => t.id === currentId) ?? threads[0]

  useEffect(() => {
    threadsRef.current = threads
  }, [threads])

  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch(() => setDatasets([]))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
        const restored: ChatThread[] = parsed.map((t) => {
          const messages = (t['messages'] as Array<Record<string, unknown>> | undefined) ?? []
          return {
            id: String(t['id']),
            title: String(t['title'] ?? 'New thread'),
            messages: messages.map((m) => ({
              id: String(m['id']),
              role: (m['role'] === 'assistant' ? 'assistant' : 'user') as ChatMessage['role'],
              content: (m['content'] as ChatMessagePart[] | undefined) ?? [],
              createdAt: new Date(String(m['createdAt'])),
            })),
            sources: (t['sources'] as ChatThread['sources'] | undefined) ?? {},
            errors: {},
            scope: String(t['scope'] ?? ''),
            running: false,
            createdAt: Number(t['createdAt'] ?? Date.now()),
            updatedAt: Number(t['updatedAt'] ?? Date.now()),
          }
        })
        if (restored.length > 0) {
          setThreads(restored)
          const latest = [...restored].sort((a, b) => b.updatedAt - a.updatedAt)[0]
          setCurrentId(latest.id)
        }
      }
    } catch {
      /* corrupted storage */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(threads.map((t) => ({ ...t, running: false, errors: {} }))),
      )
    } catch {
      /* storage full */
    }
  }, [threads, loaded])

  const updateThread = useCallback((id: string, patch: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? patch(t) : t)))
  }, [])

  const runSearch = useCallback(
    async (threadId: string, query: string, dataset: string | undefined) => {
      const assistantId = newId()
      const controller = new AbortController()
      abortRefs.current.set(threadId, controller)
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: [],
        createdAt: new Date(),
      }
      updateThread(threadId, (t) => ({
        ...t,
        running: true,
        messages: [...t.messages, assistantMessage],
        updatedAt: Date.now(),
      }))

      let reasoning = ''
      let text = ''
      let sources: ChatSource[] = []
      const toolCalls: ToolCallAcc[] = []
      let streamError: string | null = null

      const applyParts = () => {
        const parts = buildParts(reasoning, toolCalls, text)
        updateThread(threadId, (t) => ({
          ...t,
          messages: t.messages.map((m) => (m.id === assistantId ? { ...m, content: parts } : m)),
        }))
      }

      try {
        const response = await fetch('/api/open-researcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, dataset }),
          signal: controller.signal,
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            (errorData as { error?: string; message?: string }).error ||
              (errorData as { message?: string }).message ||
              'Search failed',
          )
        }
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response stream')
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6)) as {
                type?: string
                event?: { type?: string; tool?: string; parameters?: Record<string, unknown>; content?: string; result?: string }
                content?: string
                error?: string
              }
              if (data.type === 'event' && data.event) {
                const event = data.event
                if (event.type === 'thinking' && event.content) {
                  reasoning += (reasoning ? '\n' : '') + event.content
                } else if (event.type === 'tool_call') {
                  toolCalls.push({
                    id: `call-${toolCalls.length}`,
                    name: toolLabel(event.tool),
                    args: event.parameters ?? {},
                  })
                } else if (event.type === 'tool_result') {
                  const open = [...toolCalls].reverse().find((c) => c.name === toolLabel(event.tool) && c.result === undefined)
                  if (open && event.result) {
                    open.result = event.result.length > 600 ? `${event.result.slice(0, 600)}...` : event.result
                  }
                  if ((event.tool === 'web_search' || event.tool === 'search_california_law') && event.result) {
                    const parsed = parseSearchResults(event.result)
                    if (parsed.length > 0) sources = parsed
                  }
                }
                applyParts()
              } else if (data.type === 'response') {
                text = data.content ?? ''
                applyParts()
              } else if (data.type === 'error') {
                streamError = data.error ?? 'The research request failed.'
              }
            } catch {
              /* skip malformed SSE */
            }
          }
        }
        if (streamError) throw new Error(streamError)
      } catch (error) {
        if (controller.signal.aborted) {
          updateThread(threadId, (t) => ({ ...t, running: false, updatedAt: Date.now() }))
          return
        }
        const message = friendlyError(error)
        updateThread(threadId, (t) => ({
          ...t,
          running: false,
          errors: { ...t.errors, [assistantId]: message },
          updatedAt: Date.now(),
        }))
        return
      }

      updateThread(threadId, (t) => ({
        ...t,
        running: false,
        sources: { ...t.sources, [assistantId]: sources },
        updatedAt: Date.now(),
      }))
    },
    [updateThread],
  )

  const sendText = useCallback(
    (threadId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const thread = threadsRef.current.find((t) => t.id === threadId)
      if (!thread || thread.running) return
      const userMessage: ChatMessage = {
        id: newId(),
        role: 'user',
        content: [{ type: 'text', text: trimmed }],
        createdAt: new Date(),
      }
      updateThread(threadId, (t) => ({
        ...t,
        title: t.title === 'New thread' ? threadTitle(trimmed) : t.title,
        messages: [...t.messages, userMessage],
        updatedAt: Date.now(),
      }))
      runSearch(threadId, trimmed, thread.scope || undefined)
    },
    [runSearch, updateThread],
  )

  const cancelRun = useCallback(
    (threadId: string) => {
      abortRefs.current.get(threadId)?.abort()
      abortRefs.current.delete(threadId)
      updateThread(threadId, (t) => ({ ...t, running: false, updatedAt: Date.now() }))
    },
    [updateThread],
  )

  const reloadThread = useCallback(
    (threadId: string) => {
      const thread = threadsRef.current.find((t) => t.id === threadId)
      if (!thread || thread.running) return
      const lastUserIdx = [...thread.messages].reverse().findIndex((m) => m.role === 'user')
      if (lastUserIdx === -1) return
      const userMessage = thread.messages[thread.messages.length - 1 - lastUserIdx]
      const userText = userMessage.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')
      const removedIds = new Set(thread.messages.slice(thread.messages.length - lastUserIdx).map((m) => m.id))
      updateThread(threadId, (t) => {
        const sources = { ...t.sources }
        const errors = { ...t.errors }
        for (const id of removedIds) {
          delete sources[id]
          delete errors[id]
        }
        return {
          ...t,
          messages: t.messages.slice(0, thread.messages.length - lastUserIdx),
          sources,
          errors,
          updatedAt: Date.now(),
        }
      })
      runSearch(threadId, userText, thread.scope || undefined)
    },
    [runSearch, updateThread],
  )

  const newThread = useCallback(() => {
    const thread = freshThread()
    setThreads((prev) => [thread, ...prev])
    setCurrentId(thread.id)
  }, [])

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== threadId)
        if (next.length === 0) return [freshThread()]
        if (threadId === current.id) {
          setCurrentId(next[0].id)
        }
        return next
      })
    },
    [current.id],
  )

  const sidebarProps = {
    threads,
    currentId: current.id,
    onSelect: (id: string) => {
      setCurrentId(id)
    },
    onNew: newThread,
    onDelete: deleteThread,
  }

  return (
    <SidebarProvider defaultOpen={false} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 w-full flex-1">
        <Sidebar side="left" collapsible="offcanvas" className="border-r border-black/[0.08] dark:border-white/[0.09]">
          <ThreadList {...sidebarProps} />
        </Sidebar>
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ThreadView
            key={current.id}
            thread={current}
            datasets={datasets}
            onSendText={(text) => sendText(current.id, text)}
            onCancel={() => cancelRun(current.id)}
            onReload={() => reloadThread(current.id)}
            onScopeChange={(scope) => updateThread(current.id, (t) => ({ ...t, scope, updatedAt: Date.now() }))}
          />
        </SidebarInset>
      </div>
      <VoiceHead
        thread={current}
        onSendText={(text) => sendText(current.id, text)}
        onCancel={() => cancelRun(current.id)}
      />
    </SidebarProvider>
  )
}
