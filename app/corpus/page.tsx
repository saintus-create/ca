/**
 * Browse the corpus directly: every dataset on the site, searchable without
 * the agent. Same shell and band as the home page, so the two read as one
 * site.
 */
import { Metadata } from 'next'
import { NavbarFloating } from '@/components/velora/blocks/navbar-floating'
import { FooterColumns } from '@/components/velora/blocks/footer-columns'
import { CorpusBrowser } from '@/components/corpus-browser'

export const metadata: Metadata = {
  title: 'California Law, California Legislative Information',
  description: 'The California codes, the Rules of Court and the Judicial Council forms, searchable directly.',
}

export default function CorpusPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <NavbarFloating />
      <main className="pt-16 sm:pt-20">
        <CorpusBrowser />
      </main>
      <FooterColumns />
    </div>
  )
}
