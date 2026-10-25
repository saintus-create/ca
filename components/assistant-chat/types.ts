export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown>; result?: string }

/** A message in ca's own shape; rendered by the plain React thread view. */
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: ChatMessagePart[]
  createdAt: Date
}

export type ChatSource = { url: string; title: string; description?: string }

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
