/**
 * Same assembly as the home page: Velora blocks in a running order, with the
 * research chat as the working section under the hero.
 */
import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher-content'
import { isSpeechConfigured } from '@/lib/cartesia'
import { NavbarFloating } from '@/components/velora/blocks/navbar-floating'
import { FaqAccordion } from '@/components/velora/blocks/faq-accordion'
import { FooterColumns } from '@/components/velora/blocks/footer-columns'

// Voice availability comes from the environment, so this page is rendered per
// request: a key added after a build must light up the controls without a
// rebuild.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'California Legislative Information',
  description: 'The California codes, the Rules of Court and the Judicial Council forms, with answers cited to the section',
}

export default function OpenResearcherPage() {
  return (
    <div id="top" className="min-h-screen bg-background font-sans text-foreground">
      <NavbarFloating />
      <div className="py-14 sm:py-16">
        <OpenResearcherContent voiceEnabled={isSpeechConfigured()} />
      </div>
      <div id="docs" className="scroll-mt-24 bg-[#8a6d1a]/[0.05] dark:bg-white/[0.02]"><FaqAccordion /></div>
      <FooterColumns />
    </div>
  )
}
