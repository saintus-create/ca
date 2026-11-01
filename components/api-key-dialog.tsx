'use client'

// Where a visitor pastes their own API key.
//
// The alternative is an environment variable, which needs a redeploy before the
// app can answer anything. A key entered here is stored in this browser only,
// sent as a header with each request, and used for that request alone.

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  readCloudflareAccount,
  readFirecrawlKey,
  readLlmKey,
  readLlmProvider,
  saveKeys,
  type BrowserProvider,
} from '@/lib/browser-keys'

export interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the keys are saved, so the caller can retry or update state. */
  onSaved?: () => void
}

const PROVIDERS: Array<{ value: BrowserProvider; label: string }> = [
  { value: 'sarvam', label: 'Sarvam AI (default)' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI' },
  { value: 'venice', label: 'Venice (uncensored)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
]

export function ApiKeyDialog({ open, onOpenChange, onSaved }: ApiKeyDialogProps) {
  const [llmKey, setLlmKey] = useState('')
  const [provider, setProvider] = useState<BrowserProvider | ''>('')
  const [firecrawlKey, setFirecrawlKey] = useState('')
  const [accountId, setAccountId] = useState('')
  // Result of asking the provider whether the typed key works.
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Read the stored values when the dialog opens, not during render, so the
  // server and the first client render agree.
  useEffect(() => {
    if (!open) return
    setLlmKey(readLlmKey())
    setProvider(readLlmProvider())
    setFirecrawlKey(readFirecrawlKey())
    setAccountId(readCloudflareAccount())
  }, [open])

  const testKey = async () => {
    if (!llmKey.trim()) {
      setTestResult({ ok: false, message: 'Enter a key first.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/check-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: llmKey.trim(),
          provider: provider || 'sarvam',
          accountId: accountId.trim(),
        }),
      })
      const data = (await response.json()) as {
        ok?: boolean
        model?: string
        error?: string
      }
      setTestResult(
        data.ok
          ? { ok: true, message: `Works. The provider answered with ${data.model}.` }
          : { ok: false, message: data.error || 'The key did not work.' },
      )
    } catch {
      setTestResult({ ok: false, message: 'Could not reach the app to run the test.' })
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    saveKeys({ llmKey, provider, firecrawlKey, cloudflareAccount: accountId })
    onSaved?.()
    onOpenChange(false)
  }

  const clear = () => {
    saveKeys({ llmKey: '', provider: '', firecrawlKey: '', cloudflareAccount: '' })
    setLlmKey('')
    setProvider('')
    setFirecrawlKey('')
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <KeyRound className="size-4 text-citation" />
            API keys
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.6]">
            Saved in this browser and sent with each request. Nothing is written to the server, so
            this works on a deployment with no keys configured.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="llm-provider" className="text-[12.5px]">
              Provider
            </Label>
            <Select
              value={provider || 'sarvam'}
              onValueChange={(value) => {
                setProvider(value as BrowserProvider)
                setTestResult(null)
              }}
            >
              <SelectTrigger id="llm-provider" className="w-full">
                <SelectValue placeholder="Sarvam AI" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider === 'cloudflare' && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-account" className="text-[12.5px]">
                Cloudflare account ID
              </Label>
              <Input
                id="cf-account"
                autoComplete="off"
                spellCheck={false}
                placeholder="94271e3283e12efb56b539b2397e8e9a"
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value)
                  setTestResult(null)
                }}
              />
              <p className="text-[11.5px] leading-[1.5] text-muted-foreground">
                From the Workers AI dashboard. The model must support tool calling, which the
                research agent needs to search the corpus.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="llm-key" className="text-[12.5px]">
              Language model key
            </Label>
            <Input
              id="llm-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk_..."
              value={llmKey}
              onChange={(event) => {
                setLlmKey(event.target.value)
                setTestResult(null)
              }}
            />
            <p className="text-[11.5px] leading-[1.5] text-muted-foreground">
              Required for answers. Get one from dashboard.sarvam.ai, or pick Cloudflare, Venice or
              Anthropic above.
            </p>
            {testResult && (
              <p
                role="status"
                className={`text-[11.5px] leading-[1.5] ${testResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
              >
                {testResult.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firecrawl-key" className="text-[12.5px]">
              Firecrawl key <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="firecrawl-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="fc-..."
              value={firecrawlKey}
              onChange={(event) => setFirecrawlKey(event.target.value)}
            />
            <p className="text-[11.5px] leading-[1.5] text-muted-foreground">
              Only needed for live web search. California law search works without it.
            </p>
          </div>

          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[11.5px] leading-[1.5] text-muted-foreground">
            A key kept in a browser is readable by anything else running in that browser. That is
            fine on your own machine; on a shared or public deployment, set the key in the
            environment instead.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={clear} className="text-muted-foreground">
              Clear
            </Button>
            <Button type="button" variant="secondary" onClick={testKey} disabled={testing}>
              {testing ? 'Testing…' : 'Test key'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
