'use client'

// Bisect step 4: exercises the @assistant-ui/react import in isolation,
// mirroring the exact primitives the real thread view uses.
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import type { ChatMessage } from './types'

export function AssistantTest() {
  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages: [],
    isRunning: false,
    onNew: async () => {},
    onCancel: async () => {},
    onReload: async () => {},
    setMessages: () => {},
    convertMessage: (message) => message as unknown as ThreadMessageLike,
  })
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root>
        <p>Assistant test</p>
        <ThreadPrimitive.Viewport>
          <div>Empty thread</div>
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root>
          <ComposerPrimitive.Input />
          <ComposerPrimitive.Cancel asChild>
            <button type="button">Cancel</button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button type="button">Send</button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
