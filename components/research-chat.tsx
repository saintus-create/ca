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

// NOTE: Full file content continues - this is a truncated emergency stub.
// The complete file must be restored from local /tmp/ca-clone/components/research-chat.tsx
export function ResearchChat() {
  return null
}
