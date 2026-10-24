/**
 * Browse the corpus directly: every dataset on the site, searchable without
 * the agent. Shell is the same Velora running order as the home page.
 */
import { Metadata } from 'next'
import { NavbarFloating } from '@/components/velora/blocks/navbar-floating'
import { FooterColumns } from '@/components/velora/blocks/footer-columns'
import { CorpusBrowser } from '@/components/corpus-browser'

export const metadata: Metadata = {
  title: 'Browse the corpus, California Legislative Information',
  description: 'Every California code, the Rules of Court and the Judicial Council forms held on this site, searchable directly.',
}

export default function CorpusPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <NavbarFloating />
      <main className="px-6 pt-16 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Browse the corpus
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            The California codes, the Rules of Court and the Judicial Council
            forms held on this site. Pick a dataset to search inside it, or
            search across all of them at once.
          </p>
        </div>
        <div className="pt-10">
          <CorpusBrowser />
        </div>
      </main>
      <FooterColumns />
    </div>
  )
}
