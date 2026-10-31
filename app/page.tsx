/**
 * The home page is the chat application: threads in a sidebar plus the
 * research chat filling the viewport. No landing sections. The top bar sits
 * inside the chat's content area so the sidebar never covers it.
 */
import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher/open-researcher-content'

export const metadata: Metadata = {
  title: 'California Legislative Information',
  description: 'The California codes, the Rules of Court and the Judicial Council forms, with answers cited to the section.',
}

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background font-sans text-foreground">
      <OpenResearcherContent />
    </div>
  )
}
