import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher-content'
import { isSpeechConfigured } from '@/lib/cartesia'

// Voice availability comes from the environment, so this page is rendered per
// request: a key added after a build must light up the controls without a
// rebuild.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Open Researcher',
  description: 'Firecrawl-powered search, scrape, and agentic reasoning',
}

export default function OpenResearcherPage() {
  return <OpenResearcherContent voiceEnabled={isSpeechConfigured()} />
}