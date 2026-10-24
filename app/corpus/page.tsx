/**
 * The California Law page: the codes, Rules of Court and Judicial Council
 * forms, searchable directly, on the plain page shell.
 */
import { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CorpusBrowser } from '@/components/corpus-browser'

export const metadata: Metadata = {
  title: 'California Law, California Legislative Information',
  description: 'The California codes, the Rules of Court and the Judicial Council forms, searchable directly.',
}

export default function CorpusPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <CorpusBrowser />
      <SiteFooter />
    </div>
  )
}
