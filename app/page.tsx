import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher/open-researcher-content'

export const metadata: Metadata = {
  title: 'Open Researcher',
  description: 'Firecrawl-powered search, scrape, and agentic reasoning',
}

export default function Home() {
  return <OpenResearcherContent />
}
