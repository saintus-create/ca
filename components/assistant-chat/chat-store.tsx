'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { NO_VOICE, ThreadView, type VoiceAvailability } from './thread-view'
import type { ChatMessage, ChatMessagePart, ChatThread } from './types'
import { fetchDatasets, type DatasetInfo } from '@/components/corpus/datasets'
import { readSse, parseSseFrame } from '@/lib/sse'
import { applyResearchPayload, createResearchTurn, turnParts } from '@/lib/chat-stream'
import { browserRecognitionConstructor } from '@/lib/voice/dictation-adapter'

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

/** Map raw route errors to the plain visitor-facing messages the old chat used. */
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

function ThreadList({
  threads,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: {
  threads: ChatThread[]
  currentId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const visible = threads.filter((t) => t.messages.length > 0)
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm text-neutral-700 shadow-xs transition-colors hover:text-neutral-900 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-200 dark:hover:text-neutral-50"
        >
          <Plus className="size-4" />
          New thread
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {visible.map((t) => (
          <div key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                t.id === currentId
                  ? 'bg-black/[0.05] text-neutral-900 dark:bg-white/[0.07] dark:text-neutral-50'
                  : 'text-neutral-500 hover:bg-black/[0.03] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-neutral-50'
              }`}
            >
              {t.title}
            </button>
            {visible.length > 1 && (
              <button
                type="button"
                aria-label="Delete thread"
                onClick={() => onDelete(t.id)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50 ${
                  t.id === currentId ? 'block' : 'hidden group-hover:block'
                }`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The chat application: a sidebar of threads plus the assistant-ui thread.
 * The backend is unchanged: every send posts to /api/open-researcher and the
 * SSE events become reasoning, tool-call and text parts.
 */
export function AssistantChat() {
  const [threads, setThreads] = useState<ChatThread[]>(() => [freshThread()])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [voice, setVoice] = useState<VoiceAvailability>(NO_VOICE)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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

  // What voice this deployment and browser can do. The chat decides from this
  // whether Listen streams Cartesia (or falls back to browser speech), whether
  // the voice picker is shown, and whether the composer offers a microphone.
  useEffect(() => {
    let cancelled = false
    fetch('/api/voice/status')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((data: { configured?: boolean } | undefined) => {
        if (cancelled) return
        const cartesia = Boolean(data?.configured)
        const browserSpeech = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
        const browserDictation = browserRecognitionConstructor() !== undefined
        setVoice({
          cartesia,
          speech: cartesia || browserSpeech,
          dictation: cartesia || browserDictation,
        })
      })
    return () => {
      cancelled = true
    }
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
      /* corrupted storage: start fresh */
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
      /* storage full or unavailable */
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

      const turn = createResearchTurn()

      const applyParts = () => {
        const parts = turnParts(turn)
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
        if (!response.body) throw new Error('No response stream')
        // readSse buffers partial frames and multi-byte characters across
        // network chunks; a frame must never be parsed before it is whole.
        for await (const frame of readSse(response.body)) {
          const payload = parseSseFrame(frame)
          if (payload === null) continue
          if (applyResearchPayload(turn, payload, toolLabel)) applyParts()
        }
        if (turn.error) throw new Error(turn.error)
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

      abortRefs.current.delete(threadId)
      updateThread(threadId, (t) => ({
        ...t,
        running: false,
        sources: { ...t.sources, [assistantId]: turn.sources },
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
    (threadId: string, parentId?: string | null) => {
      const thread = threadsRef.current.find((t) => t.id === threadId)
      if (!thread || thread.running) return
      // assistant-ui names the message a run is being regenerated from; fall
      // back to the last question when the call comes from the message's own
      // Regenerate button, which has no parent to hand over.
      let cut = parentId ? thread.messages.findIndex((m) => m.id === parentId) : -1
      if (cut === -1) {
        const lastUserIdx = [...thread.messages].reverse().findIndex((m) => m.role === 'user')
        if (lastUserIdx === -1) return
        cut = thread.messages.length - 1 - lastUserIdx
      }
      const userMessage = thread.messages[cut]
      const userText = userMessage.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')
      const removedIds = new Set(thread.messages.slice(cut + 1).map((m) => m.id))
      updateThread(threadId, (t) => {
        const sources = { ...t.sources }
        const errors = { ...t.errors }
        for (const id of removedIds) {
          delete sources[id]
          delete errors[id]
        }
        return {
          ...t,
          messages: t.messages.slice(0, cut + 1),
          sources,
          errors,
          updatedAt: Date.now(),
        }
      })
      runSearch(threadId, userText, thread.scope || undefined)
    },
    [runSearch, updateThread],
  )

  /**
   * Saving an edited question: everything after the edited message is dropped
   * and the thread is asked again from there, so the answer below it is
   * replaced rather than appended to.
   */
  const editThread = useCallback(
    (threadId: string, parentId: string | null, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const thread = threadsRef.current.find((t) => t.id === threadId)
      if (!thread || thread.running) return

      const anchor = parentId ? thread.messages.findIndex((m) => m.id === parentId) : -1
      const cut = anchor === -1 ? 0 : anchor + 1
      const removedIds = new Set(thread.messages.slice(cut).map((m) => m.id))
      const edited: ChatMessage = {
        id: newId(),
        role: 'user',
        content: [{ type: 'text', text: trimmed }],
        createdAt: new Date(),
      }

      updateThread(threadId, (t) => {
        const sources = { ...t.sources }
        const errors = { ...t.errors }
        for (const id of removedIds) {
          delete sources[id]
          delete errors[id]
        }
        return {
          ...t,
          messages: [...t.messages.slice(0, cut), edited],
          sources,
          errors,
          updatedAt: Date.now(),
        }
      })
      runSearch(threadId, trimmed, thread.scope || undefined)
    },
    [runSearch, updateThread],
  )

  const newThread = useCallback(() => {
    const thread = freshThread()
    setThreads((prev) => [thread, ...prev])
    setCurrentId(thread.id)
    setMobileNavOpen(false)
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
      setMobileNavOpen(false)
    },
    onNew: newThread,
    onDelete: deleteThread,
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/[0.08] dark:border-white/[0.09] lg:flex">
        <ThreadList {...sidebarProps} />
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
        <ThreadView
          key={current.id}
          thread={current}
          datasets={datasets}
          voice={voice}
          onSendText={(text) => sendText(current.id, text)}
          onCancel={() => cancelRun(current.id)}
          onReload={(parentId) => reloadThread(current.id, parentId)}
          onEdit={(parentId, text) => editThread(current.id, parentId, text)}
          onScopeChange={(scope) => updateThread(current.id, (t) => ({ ...t, scope, updatedAt: Date.now() }))}
          onSetMessages={(messages) => updateThread(current.id, (t) => ({ ...t, messages: [...messages] }))}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Threads</SheetTitle>
          <ThreadList {...sidebarProps} />
        </SheetContent>
      </Sheet>
      {/* Voice and transcription failures are reported here rather than
          swallowed: an answer that cannot be read aloud should say so. */}
      <Toaster position="bottom-center" />
    </div>
  )
}
