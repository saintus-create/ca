import Link from 'next/link'

/** Plain footer: links, brand, and the not-an-official-site line. No design system. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 text-sm text-neutral-500 dark:text-neutral-400">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/corpus" className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50">
            California Law
          </Link>
          <Link href="/faq" className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50">
            FAQ
          </Link>
          <a
            href="https://github.com/saintus-create/ca"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            GitHub repository
          </a>
        </div>
        <p className="text-[13px] leading-relaxed">
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
