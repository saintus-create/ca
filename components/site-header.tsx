'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, Menu } from 'lucide-react'
import { ApiKeyDialog } from '@/components/api-key-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Mark + icon menu. No text link strip in the header. */
export function SiteHeader() {
  const [keysOpen, setKeysOpen] = useState(false)
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 px-3 sm:h-14 sm:px-5">
      <Link
        href="/"
        className="min-w-0 truncate text-[14px] font-medium tracking-[-0.02em] text-neutral-900 dark:text-neutral-50 sm:text-[15px]"
      >
        <span className="sm:hidden">CA Legislative Info</span>
        <span className="hidden sm:inline">California Legislative Information</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href="/corpus">Codes &amp; sources</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/search">Search the web</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://leginfo.legislature.ca.gov/" target="_blank" rel="noreferrer">
              Official LegInfo
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setKeysOpen(true)}>
            <KeyRound className="mr-2 size-4" />
            API keys
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://github.com/saintus-create/ca" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ApiKeyDialog open={keysOpen} onOpenChange={setKeysOpen} />
    </header>
  )
}
