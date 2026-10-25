import Link from 'next/link'

/** Plain top bar: brand on the left, sections on the right. No design system. */
export function SiteHeader() {
  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-black/[0.08] px-3 py-2 dark:border-white/[0.09] sm:px-6">
      <Link
        href="/"
        className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-[0.95rem]"
      >
        <span className="sm:hidden">California Law</span>
        <span className="hidden sm:inline">California Legislative Information</span>
      </Link>
      <nav className="flex shrink-0 items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 sm:gap-4 sm:text-sm">
        <Link href="/corpus" className="hidden transition-colors hover:text-neutral-900 dark:hover:text-neutral-50 sm:inline">
          California Law
        </Link>
        <Link href="/faq" className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50">
          FAQ
        </Link>
      </nav>
    </header>
  )
}
