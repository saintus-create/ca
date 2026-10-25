'use client'

// Mount point for scripts/test-chat-ui.mjs: the real chat screen, with no
// Next.js around it. esbuild bundles this file for the browser platform, the
// test runs the bundle inside jsdom, and the assistant-ui runtime, the
// composer and the research stream are exercised exactly as a visitor would.
import { createRoot, type Root } from 'react-dom/client'
import { AssistantChat } from '@/components/assistant-chat/chat-store'

// The test drives React through the same copy of `act` that the bundled React
// is using, so state flushed inside act() is the state the assertions see.
export { act } from 'react'

export function mount(element: HTMLElement): Root {
  const root = createRoot(element)
  root.render(<AssistantChat />)
  return root
}
