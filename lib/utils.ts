import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Hostname for display in a citation.
 *
 * Citation URLs are not always parseable: a source parsed out of a corpus hit
 * has no URL at all, and the citation list falls back to `#`. `new URL()` throws
 * on both, and a throw during render takes down the whole page, so this returns
 * a plain label instead of ever throwing.
 */
export function hostnameOf(url: string | undefined | null): string {
  if (!url || url === "#") return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
