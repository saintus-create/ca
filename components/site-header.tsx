import Link from 'next/link'

/** Site name only. Section links live in the footer — not a second brand strip. */
export function SiteHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border/80 px-4 sm:h-14 sm:px-6">
      <Link
        href="/"
        className="truncate text-[14px] font-medium tracking-[-0.02em] text-neutral-900 dark:text-neutral-50 sm:text-[15px]"
      >
        California Legislative Information
      </Link>
    </header>
  )
}
