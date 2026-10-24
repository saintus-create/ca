import Link from 'next/link'

/** Plain footer: links, brand, and the not-an-official-site line. No design system. */
export function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.08] px-4 py-8 dark:border-white/[0.09] sm:px-6">
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
          <a
            href="https://github.com/saintus-create/ca/issues"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
          >
            Report an issue
          </a>
        </div>
        <p>California Legislative Information</p>
        <p>An independent research tool, not an official website of the State of California.</p>
      </div>
    </footer>
  )
}
