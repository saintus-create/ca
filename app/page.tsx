/**
 * The home page is the chat application: a plain top bar and the research
 * chat filling the viewport. No landing sections.
 */
import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher/open-researcher-content'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'California Legislative Information',
  description: 'The California codes, the Rules of Court and the Judicial Council forms, with answers cited to the section',
}

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground">
      <SiteHeader />
      <OpenResearcherContent />
    </div>
  )
}
