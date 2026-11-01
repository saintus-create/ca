/**
 * Google Programmable Search over the web, on the same clean page shell as the
 * California Law and FAQ pages.
 *
 * This is the client-side widget Google provides for a Programmable Search
 * Engine (cx below), so results render in Google's own UI. Feeding the chat's
 * web_search tool would need the Custom Search JSON API, which requires an API
 * key as well as this cx.
 */
import { Metadata } from 'next'
import Script from 'next/script'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const CSE_CX = '01a6d23c953194451'

export const metadata: Metadata = {
  title: 'Search the web, California Legislative Information',
  description: 'Search the web alongside the California corpus.',
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <main className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            Search the web
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Google results for anything outside the corpus. For California law, ask the
            assistant on the home page, which searches the codes directly.
          </p>
          <div className="gcse-search mt-10" />
        </div>
      </main>
      <Script
        async
        src={`https://cse.google.com/cse.js
        strategy="afterInteractive"
      />
      <SiteFooter />
    </div>
  )
}
