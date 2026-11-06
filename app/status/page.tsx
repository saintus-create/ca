/**
 * Live status of every language-model provider, on the same clean shell as the
 * California Law and FAQ pages.
 *
 * Each row is the result of one real request, so a missing key, a rejected key,
 * an unfunded account and a network failure are told apart instead of all
 * surfacing as "it doesn't work".
 */
import { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { HEALTH_PROVIDERS, checkProvider } from '@/lib/provider-health'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Provider status, California Legislative Information',
  description: 'Live check of each language-model provider the app can use.',
}

export default async function StatusPage() {
  const results = await Promise.all(HEALTH_PROVIDERS.map((entry) => checkProvider(entry.id)))
  const working = results.filter((result) => result.ok).length

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <main className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            Provider status
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Each provider is asked a one-word question on this page load. {working} of{' '}
            {results.length} are answering.
          </p>

          <ul className="mt-10 divide-y divide-neutral-200 dark:divide-neutral-800">
            {results.map((result) => (
              <li key={result.provider} className="py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">
                    {result.label}
                  </h2>
                  <span
                    className={
                      result.ok
                        ? 'text-[13px] font-medium text-emerald-600 dark:text-emerald-400'
                        : result.configured
                          ? 'text-[13px] font-medium text-red-600 dark:text-red-400'
                          : 'text-[13px] font-medium text-neutral-500'
                    }
                  >
                    {result.ok ? 'Working' : result.configured ? 'Failing' : 'Not configured'}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {result.message}
                </p>
                {result.status !== null && (
                  <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-500">
                    HTTP {result.status}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <section className="mt-12 border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <p className="text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-500">
              A provider that answers here will answer in the chat. One that fails here
              fails for a reason the chat cannot fix: no key set, a key the provider
              rejects, an account with no credit, or the host being unreachable.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
