'use client'

import { useState } from 'react'
import { ResearchChat } from '@/components/research-chat'
import { SpeechProvider } from '@/components/speech-provider'

/**
 * The interactive research section: the chat. Page composition (navbar,
 * sections, footer) lives in the page files, which assemble blocks around
 * this island.
 */
export default function OpenResearcherContent({ voiceEnabled = false }: { voiceEnabled?: boolean }) {
  const [, setHasMessages] = useState(false)

  return (
    <section id="research" className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
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
