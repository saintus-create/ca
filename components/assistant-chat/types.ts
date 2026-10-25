import type { ChatMessagePart, ChatSource } from '@/lib/chat-stream'

// The wire shape (parts, sources) lives beside the stream reducer in
// lib/chat-stream.ts so it can be tested without a browser; the thread shape
// below is this screen's own storage format.
export type { ChatMessagePart, ChatSource }

/** A message in ca's own shape; converted to assistant-ui's lenient form at the runtime boundary. */
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: ChatMessagePart[]
  createdAt: Date
}

/** One conversation: its messages, the sources behind each answer, and its scope. */
export type ChatThread = {
  id: string
  title: string
  messages: ChatMessage[]
  sources: Record<string, ChatSource[]>
  errors: Record<string, string>
  scope: string
  running: boolean
  createdAt: number
  updatedAt: number
}
