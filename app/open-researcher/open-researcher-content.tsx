'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, ExternalLink, FileText, Landmark, Loader2, Scale } from 'lucide-react'
import { AnimatedGradientText } from '@/components/velora/animated-gradient-text'
import { AuroraBackground } from '@/components/velora/aurora-background'
import { ThinkingChat } from '@/components/thinking-chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function OpenResearcherContent({ voiceEnabled = false }: { voiceEnabled?: boolean }) {
  const [hasMessages, setHasMessages] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('')
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false)
  const [hasFirecrawlKey, setHasFirecrawlKey] = useState(false)

  useEffect(() => {
    // Check for Firecrawl API key on mount
    fetch('/api/check-env')
      .then(res => res.json())
      .then(data => {
        const hasEnvFirecrawlKey = data.environmentStatus.FIRECRAWL_API_KEY
        setHasFirecrawlKey(hasEnvFirecrawlKey)

        // Check localStorage for saved key if not in env
        if (!hasEnvFirecrawlKey) {
          const savedFirecrawlKey = localStorage.getItem('firecrawl_api_key')
          if (savedFirecrawlKey) {
            setFirecrawlApiKey(savedFirecrawlKey)
            setHasFirecrawlKey(true)
          }
        }
      })
      .catch(() => {
        // Fallback to checking localStorage
        const savedFirecrawlKey = localStorage.getItem('firecrawl_api_key')
        if (savedFirecrawlKey) {
          setFirecrawlApiKey(savedFirecrawlKey)
          setHasFirecrawlKey(true)
        }
      })
  }, [])

  const handleApiKeySubmit = async () => {
    if (!firecrawlApiKey.trim()) {
      toast.error('Please enter a valid Firecrawl API key')
      return
    }

    setIsValidatingApiKey(true)

    try {
      // Test the Firecrawl API key
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Firecrawl-API-Key': firecrawlApiKey,
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      })

      if (!response.ok) {
        throw new Error('Invalid Firecrawl API key')
      }

      // Save the API key to localStorage
      localStorage.setItem('firecrawl_api_key', firecrawlApiKey)
      setHasFirecrawlKey(true)
      toast.success('API key saved successfully!')
      setShowApiKeyModal(false)
    } catch {
      toast.error('Invalid API key. Please check and try again.')
    } finally {
      setIsValidatingApiKey(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-4 lg:py-5">
        <div className={`px-4 sm:px-6 lg:px-8 transition-all duration-700 ease-in-out ${hasMessages ? 'max-w-[1400px]' : 'max-w-4xl'
          } mx-auto`}>
          <div className="flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-3" aria-label="California Law home">
              <span className="grid size-10 place-items-center rounded-xl bg-[#002868] text-white shadow-[0_6px_18px_rgba(0,40,104,0.18)] transition-transform duration-200 group-hover:scale-[1.03]">
                <Scale className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight text-foreground">California Law</span>
                <span className="block text-xs text-muted-foreground">Legal research workspace</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
              <a href="https://leginfo.legislature.ca.gov/faces/codes.xhtml" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">California Codes <ArrowUpRight className="ml-0.5 inline size-3.5" /></a>
              <a href="https://www.courts.ca.gov/cms/rules/index.cfm" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">Court Rules <ArrowUpRight className="ml-0.5 inline size-3.5" /></a>
            </nav>
          </div>
        </div>
      </header>

      {/* Velora hero */}
      <section className={`relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 transition-[max-height,opacity,padding] duration-300 ${hasMessages ? 'max-h-0 overflow-hidden py-0 opacity-0' : 'max-h-[520px] py-10 sm:py-14 lg:py-16'}`}>
        <AuroraBackground intensity="subtle" className="z-[-1]" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#002868]/10 bg-white/75 px-3.5 py-1.5 text-xs font-medium tracking-wide text-[#244d83] shadow-sm backdrop-blur dark:bg-slate-950/60 dark:text-blue-200">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            CALIFORNIA LEGAL RESEARCH
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
            Find the law.<br className="hidden sm:block" /> <AnimatedGradientText className="motion-reduce:animate-none">Follow the authority.</AnimatedGradientText>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Search California statutes, court rules, and judicial forms. Get a focused research trail with source links, not a wall of untraceable answers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 backdrop-blur"><BookOpen className="size-3.5 text-[#315b9a]" /> California Codes</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 backdrop-blur"><Landmark className="size-3.5 text-[#315b9a]" /> Legislation</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 backdrop-blur"><FileText className="size-3.5 text-[#315b9a]" /> Court Rules & Forms</span>
          </div>
        </div>
      </section>

      {/* Main Content - Full width split layout */}
      <div className="relative z-10 flex-1 px-4 sm:px-6 lg:px-8">
        <div className="h-full max-w-[1400px] mx-auto">
          <ThinkingChat
            onMessagesChange={setHasMessages}
            hasFirecrawlKey={hasFirecrawlKey}
            onApiKeyRequired={() => setShowApiKeyModal(true)}
            voiceEnabled={voiceEnabled}
          />
        </div>
      </div>

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Web search (optional)</DialogTitle>
            <DialogDescription>
              Add a Firecrawl key to let answers draw on the live web alongside the corpus. The California corpus works without it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              onClick={() => window.open('https://www.firecrawl.dev', '_blank')}
              variant="code"
              className="flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Get a Firecrawl key
            </Button>
            <div className="flex flex-col gap-2">
              <Label htmlFor="firecrawl-key" className="ui-label">
                Firecrawl key
              </Label>
              <Input
                id="firecrawl-key"
                type="password"
                placeholder="fc-..."
                value={firecrawlApiKey}
                onChange={(e) => setFirecrawlApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isValidatingApiKey) {
                    handleApiKeySubmit()
                  }
                }}
                disabled={isValidatingApiKey}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleApiKeySubmit}
              disabled={isValidatingApiKey || !firecrawlApiKey.trim()}
              variant="default"
              className="w-full"
            >
              {isValidatingApiKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}