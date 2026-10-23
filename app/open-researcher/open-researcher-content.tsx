'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, Scale } from 'lucide-react'
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
import { SpeechProvider } from '@/components/speech-provider'

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
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-medium">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
                <Scale className="h-4 w-4" />
              </span>
              California Law
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className={`relative overflow-hidden px-4 sm:px-6 lg:px-8 transition-all duration-700 ease-in-out ${hasMessages
          ? 'pt-0 pb-0 opacity-0 max-h-0 overflow-hidden'
          : 'pt-8 pb-2 opacity-100 max-h-96'
        }`}>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="ui-lede mx-auto max-w-xl opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:200ms] [animation-fill-mode:forwards]">
            California statutes, rules and forms, researched and cited.
          </p>
        </div>
      </div>

      {/* Main Content - Full width split layout */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8">
        <div className="h-full max-w-[1400px] mx-auto">
          {voiceEnabled ? (
            <SpeechProvider>
              <ThinkingChat
                onMessagesChange={setHasMessages}
                hasFirecrawlKey={hasFirecrawlKey}
                onApiKeyRequired={() => setShowApiKeyModal(true)}
                voiceEnabled
              />
            </SpeechProvider>
          ) : (
            <ThinkingChat
              onMessagesChange={setHasMessages}
              hasFirecrawlKey={hasFirecrawlKey}
              onApiKeyRequired={() => setShowApiKeyModal(true)}
            />
          )}
        </div>
      </div>

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Firecrawl API Key Required</DialogTitle>
            <DialogDescription>
              This tool requires a Firecrawl API key to search and analyze web content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              onClick={() => window.open('https://www.firecrawl.dev', '_blank')}
              variant="code"
              className="flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Get Firecrawl API Key
            </Button>
            <div className="flex flex-col gap-2">
              <Label htmlFor="firecrawl-key" className="ui-label">
                Firecrawl API Key
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
              variant="orange"
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