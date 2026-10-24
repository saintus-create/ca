import Link from 'next/link'

/** Plain top bar: brand on the left, sections on the right. No design system. */
export function SiteHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] px-4 dark:border-white/[0.09] sm:px-6">
      <Link
        href="/"
        className="truncate text-[0.95rem] font-medium tracking-tight text-neutral-900 dark:text-neutral-50"
      >
        California Legislative Information
      </Link>
      <nav className="flex shrink-0 items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/corpus" className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50">
          California Law
        </Link>
        <Link href="/faq" className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50">
          FAQ
        </Link>
      </nav>
    </header>
  )
}
