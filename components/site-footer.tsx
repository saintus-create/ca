import Link from 'next/link'

/** Footer holds section links and the official-site disclaimer. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 text-sm text-neutral-500 dark:text-neutral-400">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/corpus"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            Codes &amp; sources
          </Link>
          <a
            href="https://github.com/saintus-create/ca"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            GitHub
          </a>
          <a
            href="https://leginfo.legislature.ca.gov/"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            Official LegInfo
          </a>
        </nav>
        <p className="max-w-xl text-[13px] leading-relaxed">
          Not an official California government site. For official information see{' '}
          <a
            href="https://leginfo.legislature.ca.gov/"
            className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            leginfo.legislature.ca.gov
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
