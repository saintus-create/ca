'use client'

import { useState } from 'react'
import { ResearchChat } from '@/components/research-chat'
import { SpeechProvider } from '@/components/speech-provider'

/**
 * The chat, filling the page it sits on. Empty, it centers vertically; once
 * a conversation starts, it fills the remaining height.
 */
export default function OpenResearcherContent({ voiceEnabled = false }: { voiceEnabled?: boolean }) {
  const [hasMessages, setHasMessages] = useState(false)

  return (
    <section id="research" className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 lg:px-8">
      <div
        className={`mx-auto w-full max-w-4xl ${hasMessages ? 'flex min-h-0 flex-1 flex-col' : 'my-auto'}`}
      >
        {voiceEnabled ? (
          <SpeechProvider>
            <ResearchChat
              onMessagesChange={setHasMessages}
              voiceEnabled
            />
          </SpeechProvider>
        ) : (
          <ResearchChat
            onMessagesChange={setHasMessages}
          />
        )}
      </div>

    </section>
  )
}
