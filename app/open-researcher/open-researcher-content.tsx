'use client'

import { AssistantChat } from '@/components/assistant-chat/chat-store'

/**
 * The chat application: threads in a sidebar plus the assistant-ui thread.
 * Voice returns in a follow-up pass; its controls only render when the
 * Cartesia key is configured, and no deployment currently has one.
 */
export default function OpenResearcherContent() {
  return <AssistantChat />
}
