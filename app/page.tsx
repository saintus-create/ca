/**
 * The home page, assembled from Velora UI blocks in a running order, with
 * the research chat as the working section under the hero. The blocks are
 * the design system as it ships; this file only sets the order.
 */
import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher/open-researcher-content'
import { isSpeechConfigured } from '@/lib/cartesia'
import { NavbarFloating } from '@/components/velora/blocks/navbar-floating'
import { HeroAurora } from '@/components/velora/blocks/hero-aurora'
import { LogosMarquee } from '@/components/velora/blocks/logos-marquee'
import { FeaturesBento } from '@/components/velora/blocks/features-bento'
import { FeaturesSteps } from '@/components/velora/blocks/features-steps'
import { FaqAccordion } from '@/components/velora/blocks/faq-accordion'
import { FooterColumns } from '@/components/velora/blocks/footer-columns'

// Voice availability comes from the environment, so this page is rendered per
// request: a key added after a build must light up the controls without a
// rebuild.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'California Law',
  description: 'California statutes, rules and forms, researched and cited',
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <NavbarFloating />
      <HeroAurora />
      <OpenResearcherContent voiceEnabled={isSpeechConfigured()} />
      <LogosMarquee />
      <FeaturesBento />
      <FeaturesSteps />
      <FaqAccordion />
      <FooterColumns />
    </div>
  )
}
