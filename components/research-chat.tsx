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
  /** Render the voice controls. Only true when Cartesia is configured. */
  voiceEnabled?: boolean
}

export function ResearchChat({
  onMessagesChange,
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

  // PLACEHOLDER_REST_OF_FILE - will be fixed in next commit if truncated
  return null
}
