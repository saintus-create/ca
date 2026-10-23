'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2, Send, Copy } from 'lucide-react'
import { SearchResultsDisplay } from '@/components/search-results-display'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import { readSse, parseSseFrame } from '@/lib/sse'
import { MicButton } from '@/components/mic-button'
import { SpeakButton } from '@/components/speak-button'
import { SpotlightCard } from '@/components/velora/spotlight-card'
import { TracingBeam } from '@/components/velora/tracing-beam'

// Import the ThinkingEvent type from thinking-display
import type { ThinkingEvent } from '@/components/thinking-display'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  searchData?: {
    status: 'searching' | 'complete' | 'error'
    events: ThinkingEvent[]
  }
  sources?: Array<{ url: string; title: string; description?: string }>
}

const SUGGESTED_QUERIES = [
  "How many days does a landlord have to return a security deposit after a tenant moves out?",
  "What is the statute of limitations for breach of a written contract in California?",
  "When can an officer search a car without a warrant?"
]

interface ThinkingChatProps {
  onMessagesChange?: (hasMessages: boolean) => void
  hasFirecrawlKey?: boolean
  onApiKeyRequired?: () => void
  onBrowserClose?: () => void
  /** Render browser-native microphone and read-aloud controls. */
  voiceEnabled?: boolean
}

export function ThinkingChat({ onMessagesChange, hasFirecrawlKey = false, onApiKeyRequired, voiceEnabled = false }: ThinkingChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{ url: string; title: string; description?: string }>>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [currentScrapingUrl, setCurrentScrapingUrl] = useState('')
  const [screenshots, setScreenshots] = useState<Array<{ url: string; screenshot?: string }>>([])
  const [showFullWidth, setShowFullWidth] = useState(false)
  const [hasAnimatedSuggestions, setHasAnimatedSuggestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Notify parent when messages change
  useEffect(() => {
    onMessagesChange?.(messages.length > 0)
  }, [messages.length, onMessagesChange])

  // Mark suggestions as animated after first show
  useEffect(() => {
    if (showSuggestions && !hasAnimatedSuggestions) {
      // Set after animations complete
      const timer = setTimeout(() => {
        setHasAnimatedSuggestions(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [showSuggestions, hasAnimatedSuggestions])

  const handleSearch = async (query: string) => {
    if (!query.trim() || isSearching) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsSearching(true)
    setShowSuggestions(false)
    setSearchResults([]) // Clear current search results for this query
    setCurrentScrapingUrl('') // Reset scraping URL
    setScreenshots([]) // Clear screenshots

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      searchData: {
        status: 'searching',
        events: []
      }
    }

    setMessages(prev => [...prev, assistantMessage])


    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      
      // Add Firecrawl API key from localStorage if available
      const firecrawlKey = localStorage.getItem('firecrawl_api_key')
      
      if (firecrawlKey) headers['X-Firecrawl-API-Key'] = firecrawlKey
      
      const response = await fetch('/api/open-researcher', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        // API Error occurred
        throw new Error(errorData.error || errorData.message || 'Search failed')
      }

      const body = response.body
      if (!body) throw new Error('No response stream')

      const events: ThinkingEvent[] = []
      let currentSearchResults: Array<{ url: string; title: string; description?: string }> = []
      let finalContent = ''
      let streamError: string | null = null

      for await (const frame of readSse(body)) {
        const payload = parseSseFrame(frame)
        if (payload === null) continue
        try {
              const data = JSON.parse(payload)
              
              if (data.type === 'event') {
                events.push(data.event)
                
                // Parse search results from tool results
                if (
                  data.event.type === 'tool_result' &&
                  (data.event.tool === 'web_search' || data.event.tool === 'search_california_law')
                ) {
                  const resultText = data.event.result
                  const parsedResults = parseSearchResults(resultText)
                  if (parsedResults.length > 0) {
                    currentSearchResults = parsedResults
                    setSearchResults(parsedResults)
                  }
                  
                  // Extract screenshots if available
                  if (data.event.screenshots) {
                    setScreenshots(data.event.screenshots)
                  }
                  
                  // Check if results mention scraping is happening
                  if (resultText.includes('(scraped)')) {
                    // Find first scraped URL
                    const scrapedMatch = resultText.match(/URL: (https?:\/\/[^\s]+).*?\(scraped\)/)
                    if (scrapedMatch) {
                      setCurrentScrapingUrl(scrapedMatch[1])
                    }
                  }
                }
                
                // Track current scraping URL and handle web_search with scraping
                if (data.event.type === 'tool_call') {
                  if (data.event.tool === 'web_search' || data.event.tool === 'firecrawl_search') {
                    // Update the query in the URL bar immediately
                    const searchQuery = (data.event.parameters as { query?: string })?.query || ''
                    setCurrentQuery(searchQuery)
                    setCurrentScrapingUrl('')  // Clear to show search results
                  } else if (data.event.tool === 'firecrawl_scrape' || data.event.tool === 'deep_scrape') {
                    const sourceUrl = (data.event.parameters as { source_url?: string })?.source_url || ''
                    setCurrentScrapingUrl(sourceUrl)
                  }
                } else if (data.event.type === 'tool_result') {
                  if (data.event.tool === 'deep_scrape' || data.event.tool === 'firecrawl_scrape' || data.event.tool === 'web_search') {
                    // Extract screenshots from results
                    // Always add new screenshots even if URL is the same (for multiple scrapes of same page)
                    if (data.event.screenshots) {
                      setScreenshots(prev => [...prev, ...data.event.screenshots])
                    }
                    
                    // Don't clear scraping URL immediately - let it show the screenshot
                    // Only clear when a new tool call happens
                  }
                }
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id
                    ? { ...msg, searchData: { status: 'searching', events: [...events] } }
                    : msg
                ))
              } else if (data.type === 'response') {
                finalContent = data.content
              } else if (data.type === 'error') {
                // The route reports failures inside the stream (it has already
                // sent 200), so surface them here instead of spinning forever.
                streamError = data.error || data.originalError || 'The research request failed.'
              } else if (data.type === 'done') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id
                    ? { 
                        ...msg, 
                        content: finalContent,
                        searchData: { status: 'complete', events: events },
                        sources: currentSearchResults // Keep the sources from this specific search
                      }
                    : msg
                ))
              }
        } catch (e) {
          // Ignore malformed frames; keep the stream alive for the next complete event.
        }
      }

      if (streamError) {
        throw new Error(streamError)
      }
    } catch (error) {
      // Search error occurred
      
      let errorMessage = 'Sorry, an error occurred while searching. Please try again.'
      
      if (error instanceof Error) {
        // The server already names the variable that is missing, and that is
        // the only actionable part, so show it rather than a generic apology.
        if (error.message.includes('SARVAM_API_KEY') || error.message.includes('ANTHROPIC_API_KEY')) {
          errorMessage = `The language model key is not configured on this deployment. ${error.message}`
        } else if (error.message.includes('FIRECRAWL_API_KEY')) {
          errorMessage = `Web search is not configured on this deployment. ${error.message} The California corpus still works.`
        } else if (error.message.includes('model')) {
          errorMessage = `The configured model is not available for this API key. ${error.message}`
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id
          ? { ...msg, content: errorMessage, searchData: { status: 'error', events: msg.searchData?.events ?? [] } }
          : msg
      ))
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(input)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  // Parse search results from the tool result text
  const parseSearchResults = (resultText: string) => {
    const results: Array<{ url: string; title: string; description?: string; index?: number; scraped?: boolean; dateFound?: string; markdown?: string }> = []
    const lines = resultText.split('\n')
    let currentResult: { url?: string; title?: string; description?: string; index?: number; scraped?: boolean; dateFound?: string; markdown?: string } | null = null
    
    for (const line of lines) {
      // Match result entries like "[1] Title"
      const titleMatch = line.match(/^\[(\d+)\]\s+(.+)$/)
      if (titleMatch) {
        // Corpus hits cite a statute and carry no URL, so a URL cannot be a
        // requirement for keeping a result.
        if (currentResult && currentResult.title) {
          results.push(currentResult as { url: string; title: string; description?: string })
        }
        currentResult = {
          index: parseInt(titleMatch[1]),
          title: titleMatch[2].replace(' (scraped)', ''),
          scraped: line.includes('(scraped)')
        }
        continue
      }
      
      // Match URL lines
      if (line.startsWith('URL: ') && currentResult) {
        currentResult.url = line.substring(5)
        continue
      }

      // Corpus hits cite the statute rather than a page URL
      if (line.startsWith('Source: ') && currentResult) {
        currentResult.url = line.substring(8).trim()
        continue
      }
      
      // Match description lines
      if (line.startsWith('Description: ') && currentResult) {
        currentResult.description = line.substring(13)
        continue
      }
      
      // Match date lines
      if (line.startsWith('Date: ') && currentResult) {
        currentResult.dateFound = line.substring(6)
        continue
      }
      
      // Match content preview
      if (line.startsWith('Content preview: ') && currentResult) {
        currentResult.markdown = line.substring(17)
        continue
      }

      // Corpus snippets arrive as a bare line beneath the citation, with no
      // "Key: " prefix to match on.
      if (
        currentResult &&
        !currentResult.description &&
        line.trim().length > 40 &&
        !/^[A-Za-z][A-Za-z ]{0,12}: /.test(line)
      ) {
        currentResult.description = line.trim()
        continue
      }
    }
    
    // Don't forget the last result
    if (currentResult && currentResult.title) {
      results.push(currentResult as { url: string; title: string; description?: string })
    }
    
    return results
  }

  const hasMessages = messages.length > 0

  // If no messages, show input below hero section
  if (!hasMessages) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-4 lg:mt-8 px-4 lg:px-0 motion-safe:animate-fade-up">
        <div className="space-y-4 lg:space-y-8">
          <form onSubmit={handleSubmit} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Enter query..."
              className="ui-control w-full h-14 rounded-2xl border border-border/70 bg-background/95 pl-5 pr-24 text-base text-foreground shadow-[0_12px_40px_rgba(25,45,90,0.08)] backdrop-blur-xl ring-offset-background placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:border-[#5279bd] focus-visible:ring-2 focus-visible:ring-[#5279bd]/25 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSearching}
            />
            {voiceEnabled && (
              <span className="absolute right-12 top-2">
                <MicButton
                  disabled={isSearching}
                  onTranscript={(text) => {
                    setInput(text)
                    inputRef.current?.focus()
                  }}
                />
              </span>
            )}
            <button
              type="submit"
              disabled={isSearching || !input.trim()}
              className="absolute right-2 top-2 h-10 w-10 bg-[#002868] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,background-color] duration-200 flex items-center justify-center hover:bg-[#0a3d86] active:scale-95"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          {!hasFirecrawlKey && (
            <button
              type="button"
              onClick={() => onApiKeyRequired?.()}
              className="ui-caption mx-auto flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              Web search is off. Searching the corpus only. Add a Firecrawl key
            </button>
          )}

          {showSuggestions && !isSearching && (
            <div className="space-y-2">
              <div className={cn(
                "ui-caption flex items-center gap-2",
                !hasAnimatedSuggestions && "animate-fade-up"
              )} style={{ 
                animationDelay: !hasAnimatedSuggestions ? '200ms' : '0ms',
                opacity: !hasAnimatedSuggestions ? 0 : 1
              }}>
                <span>Try asking:</span>
                <ChevronDown className={cn(
                  "h-3 w-3",
                  !hasAnimatedSuggestions && "animate-bounce"
                )} style={{ animationDelay: !hasAnimatedSuggestions ? '500ms' : '0ms' }} />
              </div>
              <div className="space-y-2">
                {SUGGESTED_QUERIES.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "ui-body w-full rounded-lg border border-border/70 bg-muted/60 px-3.5 py-3 text-left transition-all duration-300 hover:border-border hover:bg-muted hover:shadow-sm",
                      !hasAnimatedSuggestions && "animate-fade-up"
                    )}
                    style={{ 
                      animationDelay: !hasAnimatedSuggestions ? `${300 + idx * 80}ms` : '0ms',
                      opacity: !hasAnimatedSuggestions ? 0 : 1,
                      transform: 'translateZ(0)' // Force GPU acceleration to prevent cutoff
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Split layout when messages exist
  return (
    <div className="flex flex-col-reverse lg:flex-row gap-2 lg:gap-4 h-[calc(100vh-120px)] lg:h-[calc(100vh-200px)] animate-slide-up pt-2 lg:pt-5">
      {/* Chat interface - Bottom on mobile, Left on desktop */}
      <SpotlightCard className={cn(
        "flex flex-col transition-all duration-700 ease-out",
        showFullWidth ? "h-full w-full" : "h-[45vh] lg:h-full lg:w-1/2" // Full height on mobile when browser closed
      )}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex animate-fade-in",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'user' ? (
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground shadow-sm lg:max-w-[80%] lg:px-4 lg:py-3">
                  {message.content}
                </div>
              ) : (
                <div className="max-w-[90%] space-y-3">
                  {/* Show thinking events if available */}
                  {message.searchData?.events && message.searchData.events.length > 0 && (
                    <TracingBeam className="pl-5">
                    <div className="space-y-2">
                      {message.searchData.events.map((event, idx) => {
                        const colorClass = "border-border bg-muted/50"
                        const textColorClass = "text-foreground/90"
                          
                        if (event.type === 'thinking') {
                          return (
                            <div key={idx} className={`px-3 lg:px-4 py-2 lg:py-3 rounded-lg border ${colorClass} max-w-[90%] lg:max-w-[80%]`}>
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-to mt-1.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className={`ui-subtitle ${textColorClass} mb-1`}>
                                    Thinking Block #{event.number}
                                  </div>
                                  <div className={`ui-body whitespace-pre-wrap ${textColorClass}`}>
                                    {event.content || ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        if (event.type === 'tool_call') {
                          const isWebSearch = event.tool === 'firecrawl_search' || event.tool === 'web_search'
                          const isDeepScrape = event.tool === 'firecrawl_scrape' || event.tool === 'deep_scrape'
                          return (
                            <div key={idx} className={`px-3 lg:px-4 py-2 rounded-lg border ${colorClass} max-w-[90%] lg:max-w-[80%]`}>
                              <div className="flex items-start gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isWebSearch ? 'bg-brand-via' : isDeepScrape ? 'bg-brand' : 'bg-muted-foreground'} mt-1.5 flex-shrink-0`} />
                                <div className="flex-1">
                                  <div className="ui-subtitle">
                                    <span className={textColorClass}>
                                      {isWebSearch ? 'Web Search' : isDeepScrape ? 'Deep Scrape' : event.tool === 'search_california_law' ? 'California Law Corpus' : event.tool === 'analyze_content' ? 'Content Analysis' : 'Research Step'}
                                    </span>
                                  </div>
                                  {(event as { parameters?: { query?: string } }).parameters?.query && (
                                    <div className="ui-body mt-1 text-muted-foreground">
                                      &quot;{(event as { parameters?: { query?: string } }).parameters?.query}&quot;
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                        if (event.type === 'tool_result' && event.result) {
                          const resultPreview = event.result.substring(0, 100)
                          return (
                            <div key={idx} className={`px-3 lg:px-4 py-2 rounded-lg border ${colorClass} max-w-[90%] lg:max-w-[80%]`}>
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-to mt-1.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <span className={`ui-subtitle ${textColorClass}`}>
                                      Results Received
                                    </span>
                                    <span className="ui-caption shrink-0 tabular-nums">
                                      {event.duration ? `${(event.duration / 1000).toFixed(1)}s` : ''}
                                    </span>
                                  </div>
                                  <div className="ui-caption mt-1 line-clamp-2 break-words">
                                    {resultPreview}...
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                    </TracingBeam>
                  )}
                  
                  {/* Show final response */}
                  {message.content ? (
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-4 sm:px-5 sm:py-5",
                        message.searchData?.status === 'error'
                          ? "border border-destructive/30 bg-destructive/5 text-destructive"
                          : "border border-border/50 bg-card/80 shadow-[0_8px_30px_rgba(20,35,70,0.04)] backdrop-blur-sm"
                      )}
                    >
                      <MarkdownRenderer
                        content={message.content}
                        sources={message.sources || []}
                      />
                    </div>
                  ) : isSearching && message.searchData?.status === 'searching' ? (
                    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 animate-fade-in" style={{ animationDelay: '200ms', opacity: 0 }}>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand-to" />
                        <span className="ui-body text-muted-foreground">
                          Researching...
                        </span>
                      </div>
                    </div>
                  ) : null}
                  
                  {/* Action buttons for completed responses */}
                  {message.role === 'assistant' && message.content && message.searchData?.status === 'complete' && (
                    <div className="mt-3 flex items-center justify-end gap-1">
                      {voiceEnabled && (
                        <SpeakButton id={message.id} text={message.content} />
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message.content)
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area with firesearch style */}
        <div className="border-t border-border p-2 lg:p-3">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a California law question…"
                className="ui-control w-full h-14 rounded-2xl border border-border/70 bg-background/95 pl-5 pr-24 text-base text-foreground shadow-[0_8px_28px_rgba(25,45,90,0.07)] backdrop-blur-xl ring-offset-background placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:border-[#5279bd] focus-visible:ring-2 focus-visible:ring-[#5279bd]/25 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSearching}
              />
              {voiceEnabled && (
                <span className="absolute right-12 top-3">
                  <MicButton
                    disabled={isSearching}
                    onTranscript={(text) => {
                      setInput(text)
                      inputRef.current?.focus()
                    }}
                  />
                </span>
              )}
              <button
                type="submit"
                disabled={isSearching || !input.trim()}
                className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-[#002868] text-white transition-[transform,background-color] duration-200 hover:bg-[#0a3d86] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </SpotlightCard>

      {/* Browser/Search Results - Top on mobile, Right on desktop */}
      <div className={cn(
        "transition-all duration-700 ease-out",
        showFullWidth 
          ? "w-0 opacity-0 h-0 overflow-hidden" 
          : "h-[45vh] lg:h-full lg:w-1/2"
      )}>
        <SearchResultsDisplay
          query={currentQuery}
          results={searchResults} // Show only current search results
          isActive={isSearching}
          currentUrl={currentScrapingUrl}
          screenshots={screenshots}
          onClose={() => {
            setShowFullWidth(true)
          }}
        />
      </div>
    </div>
  )
}