'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { SpeakButton } from '@/components/speak-button'
import { useSpeechController } from '@/components/speech-provider'
import { ChatEmptyState } from '@/components/spectrum/ai-assistants/chat-empty-state'
import { PromptComposer } from '@/components/spectrum/ai-assistants/prompt-composer'
import { ReasoningTrace } from '@/components/spectrum/ai-assistants/reasoning-trace'
import { ToolChips } from '@/components/spectrum/ai-assistants/tool-chips'
import { ThinkingDots } from '@/components/spectrum/ai-assistants/thinking-dots'
import { MessageActions } from '@/components/spectrum/ai-assistants/message-actions'
import { VoiceInput, type VoiceInputState } from '@/components/spectrum/ai-assistants/voice-input'
import { ErrorState } from '@/components/spectrum/ai-assistants/error-state'
import type {
  ReasoningStep,
  SuggestedPrompt,
  ToolCall,
} from '@/components/spectrum/ai-assistants/types'
import { LiveWaveform } from '@/components/elevenlabs/live-waveform'
import { BarVisualizer } from '@/components/elevenlabs/bar-visualizer'
import { fetchDatasets, groupDatasets, type DatasetInfo } from '@/components/corpus/datasets'

export interface ThinkingEvent {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'summary'
  timestamp?: number
  content?: string
  number?: number
  tool?: string
  parameters?: Record<string, unknown>
  result?: string
  searchResults?: Array<{
    url: string
    title: string
    description: string
    markdown?: string
  }>
  screenshots?: Array<{ url: string; screenshot?: string }>
  duration?: number
  thinkingBlocks?: number
  toolCalls?: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  searchData?: {
    status: 'searching' | 'complete' | 'error'
    events: ThinkingEvent[]
    startedAt: number
    durationMs?: number
  }
  sources?: Array<{ url: string; title: string; description?: string }>
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'deposit',
    label: 'How many days does a landlord have to return a security deposit?',
    prompt:
      'How many days does a landlord have to return a security deposit after a tenant moves out?',
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

const TOOL_LABELS: Record<string, string> = {
  search_california_law: 'California Law Corpus',
  web_search: 'Web Search',
  firecrawl_search: 'Web Search',
  firecrawl_scrape: 'Deep Scrape',
  deep_scrape: 'Deep Scrape',
  analyze_content: 'Content Analysis',
}

function toolLabel(tool?: string): string {
  return (tool && TOOL_LABELS[tool]) || 'Research Step'
}

/** Shape the raw agent events into Spectrum's reasoning steps and tool calls. */
function shapeEvents(events: ThinkingEvent[]) {
  const steps: ReasoningStep[] = []
  const calls: ToolCall[] = []
  events.forEach((event, idx) => {
    if (event.type === 'thinking' && event.content) {
      steps.push({ id: `step-${idx}`, content: event.content })
    } else if (event.type === 'tool_call') {
      calls.push({
        id: `call-${idx}`,
        name: toolLabel(event.tool),
        args: event.parameters,
        status: 'running',
        startedAt: Date.now(),
      })
    } else if (event.type === 'tool_result') {
      const open = [...calls].reverse().find((c) => c.status === 'running' && c.name === toolLabel(event.tool))
      if (open) {
        open.status = 'success'
        open.completedAt = open.startedAt ? open.startedAt + (event.duration ?? 0) : undefined
        open.result = event.result
          ? event.result.length > 600
            ? `${event.result.slice(0, 600)}...`
            : event.result
          : undefined
      }
    }
  })
  return { steps, calls }
}

interface ResearchChatProps {
  onMessagesChange?: (hasMessages: boolean) => void
  hasFirecrawlKey?: boolean
  onApiKeyRequired?: () => void
  /** Render the voice controls. Only true when Cartesia is configured. */
  voiceEnabled?: boolean
}

export function ResearchChat({
  onMessagesChange,
  hasFirecrawlKey = false,
  onApiKeyRequired,
  voiceEnabled = false,
}: ResearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [scope, setScope] = useState('')
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])

  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch(() => setDatasets([]))
  }, [])
  const [voiceState, setVoiceState] = useState<VoiceInputState>('idle')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    onMessagesChange?.(messages.length > 0)
  }, [messages.length, onMessagesChange])

  // Parse search results from the tool result text (same format the agent emits).
  const parseSearchResults = (resultText: string) => {
    const results: Array<{
      url: string
      title: string
      description?: string
      index?: number
      scraped?: boolean
      dateFound?: string
      markdown?: string
    }> = []
    const lines = resultText.split('\n')
    let current: (typeof results)[number] | null = null

    for (const line of lines) {
      const titleMatch = line.match(/^\[(\d+)\]\s+(.+)$/)
      if (titleMatch) {
        if (current && current.title) results.push(current)
        current = {
          url: '',
          index: parseInt(titleMatch[1]),
          title: titleMatch[2].replace(' (scraped)', ''),
          scraped: line.includes('(scraped)'),
        }
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
      if (line.startsWith('Date: ') && current) {
        current.dateFound = line.substring(6)
        continue
      }
      if (line.startsWith('Content preview: ') && current) {
        current.markdown = line.substring(17)
        continue
      }
      if (
        current &&
        !current.description &&
        line.trim().length > 40 &&
        !/^[A-Za-z][A-Za-z ]{0,12}: /.test(line)
      ) {
        current.description = line.trim()
        continue
      }
    }
    if (current && current.title) results.push(current)
    return results
  }

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || isSearching) return

      const userMessage: Message = { id: Date.now().toString(), role: 'user', content: query }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        searchData: { status: 'searching', events: [], startedAt: Date.now() },
      }
      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsSearching(true)

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const firecrawlKey = localStorage.getItem('firecrawl_api_key')
        if (firecrawlKey) headers['X-Firecrawl-API-Key'] = firecrawlKey

        const response = await fetch('/api/open-researcher', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, dataset: scope || undefined }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || errorData.message || 'Search failed')
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No response stream')

        const events: ThinkingEvent[] = []
        const collectedSources: Message['sources'] = []
        let finalContent = ''
        let streamError: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'event') {
                events.push(data.event)
                if (
                  data.event.type === 'tool_result' &&
                  (data.event.tool === 'web_search' || data.event.tool === 'search_california_law')
                ) {
                  const parsed = parseSearchResults(data.event.result || '')
                  if (parsed.length > 0) {
                    collectedSources.length = 0
                    collectedSources.push(
                      ...parsed.map((r) => ({
                        url: r.url,
                        title: r.title,
                        description: r.description,
                      })),
                    )
                  }
                }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, searchData: { status: 'searching', events: [...events], startedAt: assistantMessage.searchData!.startedAt } }
                      : msg,
                  ),
                )
              } else if (data.type === 'response') {
                finalContent = data.content
              } else if (data.type === 'error') {
                streamError = data.error || data.originalError || 'The research request failed.'
              } else if (data.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          content: finalContent,
                          searchData: {
                            status: 'complete',
                            events,
                            startedAt: assistantMessage.searchData!.startedAt,
                            durationMs: Date.now() - assistantMessage.searchData!.startedAt,
                          },
                          sources: collectedSources,
                        }
                      : msg,
                  ),
                )
              }
            } catch {
              // Error parsing SSE data
            }
          }
        }

        if (streamError) throw new Error(streamError)
      } catch (error) {
        let errorMessage = 'Sorry, an error occurred while searching. Please try again.'
        if (error instanceof Error) {
          if (error.message.includes('SARVAM_API_KEY') || error.message.includes('ANTHROPIC_API_KEY') || error.message.includes('not configured')) {
            errorMessage = 'The research service is not set up on this deployment yet. The operator needs to add the language model key before questions can be answered.'
          } else if (error.message.includes('FIRECRAWL_API_KEY')) {
            errorMessage = 'Web search is not configured on this deployment. The California corpus still works.'
          } else if (error.message.includes('model')) {
            errorMessage = 'The configured model is not available for this API key.'
          } else {
            errorMessage = `Error: ${error.message}`
          }
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: errorMessage,
                  searchData: {
                    status: 'error',
                    events: msg.searchData?.events ?? [],
                    startedAt: msg.searchData?.startedAt ?? Date.now(),
                  },
                }
              : msg,
          ),
        )
      } finally {
        setIsSearching(false)
      }
    },
    [isSearching, scope],
  )

  // Voice capture: the ElevenLabs LiveWaveform owns the microphone stream and
  // hands it over, and the same stream feeds the recorder that posts to the
  // existing speech-to-text route.
  const startRecorder = useCallback((stream: MediaStream) => {
    try {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mime = candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        if (discardRef.current) {
          setVoiceState('idle')
          return
        }
        setVoiceState('processing')
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        try {
          const form = new FormData()
          const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
          form.append('audio', blob, `query.${ext}`)
          const res = await fetch('/api/voice/stt', { method: 'POST', body: form })
          const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
          if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status}).`)
          const text = (data.text || '').trim()
          if (text) {
            handleSearch(text)
          } else {
            toast.error('I could not hear a question in that recording.')
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Transcription failed.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorderRef.current = recorder
      recorder.start()
    } catch {
      toast.error('Voice recording is not available in this browser.')
      setVoiceState('idle')
    }
  }, [handleSearch])

  const stopRecorder = useCallback((discard: boolean) => {
    discardRef.current = discard
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else if (discard) {
      setVoiceState('idle')
    }
    recorderRef.current = null
  }, [])

  const scopeStrip = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-3.5 py-2 dark:border-white/[0.07]">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <label
          htmlFor="corpus-scope"
          className="shrink-0 whitespace-nowrap text-[12.5px] text-neutral-500 dark:text-neutral-400"
        >
          Search in
        </label>
        <select
          id="corpus-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
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
      <a
        href="/corpus"
        className="text-[12.5px] text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:decoration-neutral-600 dark:hover:text-neutral-100"
      >
        Browse the corpus
      </a>
    </div>
  )

  const voiceControls = voiceEnabled ? (
    <div className="flex flex-col items-center gap-3">
      {voiceState === 'idle' ? (
        <VoiceInput
          state="idle"
          onStart={() => {
            discardRef.current = false
            setVoiceState('recording')
          }}
        />
      ) : (
        <div className="flex w-full max-w-[560px] flex-col items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 dark:border-white/[0.09] dark:bg-[#0B0B0D]">
          <LiveWaveform
            active={voiceState === 'recording'}
            processing={voiceState === 'processing'}
            mode="static"
            height={56}
            className="w-full"
            onStreamReady={startRecorder}
            onError={() => {
              toast.error('Microphone access was not granted.')
              setVoiceState('idle')
            }}
          />
          <VoiceInput
            state={voiceState}
            onConfirm={() => stopRecorder(false)}
            onCancel={() => stopRecorder(true)}
          />
        </div>
      )}
    </div>
  ) : null

  const firecrawlNotice = !hasFirecrawlKey ? (
    <button
      type="button"
      onClick={() => onApiKeyRequired?.()}
      className="text-[12.5px] text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
    >
      Web search is off. Searching the corpus only. Add a Firecrawl key
    </button>
  ) : null

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 rounded-2xl border border-black/[0.08] bg-white px-6 py-8 shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
        <ChatEmptyState
          variant="Centered"
          title="Ask about California law"
          subtitle="Statutes, court rules and forms, researched live and cited to the section."
          prompts={SUGGESTED_PROMPTS}
          onSelectPrompt={(p) => handleSearch(p.prompt || p.label)}
        />
        <div className="w-full">
          {scopeStrip}
          <PromptComposer
            placeholder="Ask anything about California law"
            isGenerating={isSearching}
            onSend={(text) => handleSearch(text)}
            variant="Minimal"
            maxLength={8000}
            className="max-w-none rounded-none border-0 bg-transparent shadow-none"
          />
        </div>
        {voiceControls}
        {firecrawlNotice}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-h-[72vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.map((message, messageIdx) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-[13.5px] leading-relaxed text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {message.content}
                </div>
              </div>
            )
          }

          const { steps, calls } = shapeEvents(message.searchData?.events ?? [])
          const status = message.searchData?.status
          const precedingUser = [...messages.slice(0, messageIdx)].reverse().find((m) => m.role === 'user')

          return (
            <div key={message.id} className="group/message space-y-3">
              {steps.length > 0 && (
                <ReasoningTrace
                  steps={steps}
                  status={status === 'searching' ? 'thinking' : 'complete'}
                  durationMs={message.searchData?.durationMs}
                  defaultOpen={status === 'searching'}
                />
              )}
              {calls.length > 0 && <ToolChips calls={calls} variant="Stack" />}

              {status === 'error' ? (
                <ErrorState
                  variant="Inline"
                  title={
                    message.content.includes('not set up on this deployment')
                      ? 'The research service is not set up yet'
                      : 'That search did not finish'
                  }
                  message={message.content}
                  retryLabel="Try again"
                  onRetry={() => precedingUser && handleSearch(precedingUser.content)}
                />
              ) : message.content ? (
                <div className="text-[13.5px] leading-[1.7] text-neutral-700 dark:text-neutral-300">
                  <MarkdownRenderer content={message.content} sources={message.sources || []} />
                </div>
              ) : status === 'searching' ? (
                <ThinkingDots label="Researching" />
              ) : null}

              {status === 'complete' && message.content && (
                <div className="flex items-center gap-2">
                  {voiceEnabled && <SpeakButton id={message.id} text={message.content} />}
                  {voiceEnabled && <SpeakingVisual messageId={message.id} />}
                  <MessageActions
                    content={message.content}
                    onRegenerate={() => precedingUser && handleSearch(precedingUser.content)}
                  />
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="space-y-3 border-t border-black/[0.06] px-4 py-4 dark:border-white/[0.07]">
        <div className="mx-auto w-full max-w-[640px]">
          {scopeStrip}
          <PromptComposer
            placeholder="Ask a follow-up"
            isGenerating={isSearching}
            onSend={(text) => handleSearch(text)}
            variant="Minimal"
            maxLength={8000}
            className="max-w-none rounded-none border-0 bg-transparent shadow-none"
          />
        </div>
        {voiceControls}
        <div className="text-center">{firecrawlNotice}</div>
      </div>
    </div>
  )
}

/** ElevenLabs bar visualizer, shown while this message is being read aloud. */
function SpeakingVisual({ messageId }: { messageId: string }) {
  const speech = useSpeechController()
  if (speech.activeId !== messageId || speech.status !== 'playing') return null
  return (
    <BarVisualizer
      state="speaking"
      demo
      barCount={16}
      className="h-6 w-24"
      aria-hidden
    />
  )
}
