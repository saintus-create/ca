'use client'

import { AssistantChat } from '@/components/assistant-chat/chat-store'

/**
 * The chat application: threads in a sidebar plus the thread view.
 * Voice returns in a follow-up pass, browser-native like the old site, so it
 * needs no key; Cartesia stays optional, never required.
 */
export default function OpenResearcherContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantChat />
    </div>
  )
}
