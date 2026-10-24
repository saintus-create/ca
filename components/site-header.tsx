import Link from 'next/link'

/** Plain top bar: brand on the left, sections on the right. No design system. */
export function SiteHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] px-3 dark:border-white/[0.09] sm:px-6">
      <Link
        href="/"
        className="truncate text-[13px] font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-[0.95rem]"
      >
        California Legislative Information
      </Link>
      <nav className="flex shrink-0 items-center gap-3 text-[13px] text-neutral-500 dark:text-neutral-400 sm:gap-4 sm:text-sm">
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
