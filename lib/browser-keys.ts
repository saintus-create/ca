// API keys held in the visitor's own browser.
//
// A deployment can set its keys in the environment, but that means a redeploy
// before the app can be used at all. This lets someone paste their own key and
// start immediately: it is stored in localStorage, sent as a header on each
// request, and used for that request only. It is never written to the server's
// environment, so it cannot leak to another visitor.
//
// The trade-off is honest and worth knowing: a key in localStorage is readable
// by any script running on the page, and by anyone using that browser profile.
// That is fine for your own machine; for a shared or public deployment, set the
// key in the environment instead.

export const LLM_KEY_STORAGE = 'ca-llm-key'
export const LLM_PROVIDER_STORAGE = 'ca-llm-provider'
export const FIRECRAWL_KEY_STORAGE = 'ca-firecrawl-key'

export type BrowserProvider = 'sarvam' | 'venice' | 'anthropic'

function read(name: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(name)?.trim() ?? ''
  } catch {
    // Private mode, or storage disabled.
    return ''
  }
}

function write(name: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    if (value.trim()) window.localStorage.setItem(name, value.trim())
    else window.localStorage.removeItem(name)
  } catch {
    /* storage unavailable */
  }
}

export function readLlmKey(): string {
  return read(LLM_KEY_STORAGE)
}

export function readLlmProvider(): BrowserProvider | '' {
  const value = read(LLM_PROVIDER_STORAGE)
  return value === 'sarvam' || value === 'venice' || value === 'anthropic' ? value : ''
}

export function readFirecrawlKey(): string {
  return read(FIRECRAWL_KEY_STORAGE)
}

/** Headers carrying whatever keys this browser holds. */
export function keyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const llmKey = readLlmKey()
  if (llmKey) headers['X-LLM-API-Key'] = llmKey
  const provider = readLlmProvider()
  if (provider) headers['X-LLM-Provider'] = provider
  const firecrawlKey = readFirecrawlKey()
  if (firecrawlKey) headers['X-Firecrawl-API-Key'] = firecrawlKey
  return headers
}

export function saveKeys(input: {
  llmKey: string
  provider: BrowserProvider | ''
  firecrawlKey: string
}): void {
  write(LLM_KEY_STORAGE, input.llmKey)
  write(LLM_PROVIDER_STORAGE, input.provider)
  write(FIRECRAWL_KEY_STORAGE, input.firecrawlKey)
}
