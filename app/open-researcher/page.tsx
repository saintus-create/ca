import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher-content'

export const metadata: Metadata = {
  title: 'Open Researcher',
  description: 'Firecrawl-powered search, scrape, and agentic reasoning',
}

export default function OpenResearcherPage() {
  return <OpenResearcherContent />
}