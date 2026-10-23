import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/velora/ui/button";
import { ResizableNavbar } from "@/components/velora/resizable-navbar";

const BRAND = "California Legislative Information";

const LINKS = [
  { label: "Corpus", href: "#corpus" },
  { label: "How it works", href: "#how" },
  { label: "Sources", href: "#sources" },
  { label: "Docs", href: "#docs" },
  { label: "GitHub", href: "https://github.com/saintus-create/ca" },
];

function Logo() {
  return (
    <a
      href="#"
      className="flex items-center gap-2 rounded-full pr-1 text-[0.95rem] font-medium tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-brand-from via-brand-via to-brand-to text-brand-foreground shadow-sm shadow-brand/30"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-4">
          <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
          <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
        </svg>
      </span>
      {BRAND}
    </a>
  );
}

/**
 * Full-width navbar that shrinks into a centred, blurred pill once the page
 * scrolls, with sign-in and sign-up actions. Below a 48rem container width
 * the links fold into a disclosure menu. The faded page underneath is
 * placeholder content — delete it and drop the navbar into your layout.
 */
export function NavbarFloating() {
  return (
    <div className="relative isolate overflow-x-clip">
      <ResizableNavbar
        items={LINKS}
        logo={<Logo />}
        className="pt-3"
        cta={
          <div className="grid grid-cols-2 gap-2 @3xl/navbar:flex @3xl/navbar:items-center @3xl/navbar:gap-1">
            <Button variant="ghost" className="h-9 rounded-full px-4 @max-3xl/navbar:border-border" asChild>
              <a href="https://github.com/saintus-create/ca">GitHub</a>
            </Button>
            <Button className="h-9 rounded-full px-4" asChild>
              <a href="#research">
                Start researching <ArrowRightIcon data-icon="end" />
              </a>
            </Button>
          </div>
        }
      />

    </div>
  );
}
