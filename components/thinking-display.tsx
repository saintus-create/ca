'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Brain, 
  Search, 
  FileText, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  AlertCircle,
  Clock,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ScreenshotPreview } from '@/components/screenshot-preview'
import { SearchResultsDisplay } from '@/components/search-results-display'

export interface ThinkingEvent {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'summary'
  timestamp?: number
  content?: string
  number?: number
  tool?: string
  parameters?: Record<string, unknown>
  result?: string
  searchResults?: Array<{
    url: string
    title: string
    description: string
    markdown?: string
  }>
  screenshots?: Array<{ url: string; screenshot?: string }>
  duration?: number
  thinkingBlocks?: number
  toolCalls?: number
}

interface ThinkingDisplayProps {
  events: ThinkingEvent[]
  status: 'searching' | 'complete' | 'error'
  response?: string
}

const eventIcons: Record<string, React.ComponentType<{className?: string}>> = {
  start: Sparkles,
  thinking: Brain,
  tool_call: Search,
  tool_result: FileText,
  response: CheckCircle2,
  summary: Sparkles
}

const toolNames: Record<string, string> = {
  web_search: 'Web Search',
  firecrawl_search: 'Web Search',
  deep_scrape: 'Deep Web Scrape',
  firecrawl_scrape: 'Deep Web Scrape',
  analyze_content: 'Content Analysis'
}

const getEventIcon = (event: ThinkingEvent) => {
  const Icon = eventIcons[event.type] || AlertCircle
  return Icon
}

const getEventColor = (event: ThinkingEvent, index: number) => {
  const isOdd = index % 2 === 1
  if (isOdd) {
    return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10'
  } else {
    return 'text-foreground bg-muted/60'
  }
}

const getEventTitle = (event: ThinkingEvent) => {
  switch (event.type) {
    case 'start':
      return 'Research Started'
    case 'thinking':
      return `Thinking Block #${event.number || 1}`
    case 'tool_call':
      return toolNames[event.tool || ''] || event.tool || 'Tool Call'
    case 'tool_result':
      return 'Results Received'
    case 'response':
      return 'Generating Response'
    case 'summary':
      return 'Research Complete'
    default:
      return 'Processing'
  }
}

const formatDuration = (ms?: number) => {
  if (!ms) return ''
  return `${(ms / 1000).toFixed(1)}s`
}

export function ThinkingDisplay({ events, status, response }: ThinkingDisplayProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [allScreenshots, setAllScreenshots] = useState<Array<{ url: string; screenshot?: string }>>([])
  const [viewMode, setViewMode] = useState<'timeline' | 'results' | 'screenshots'>('timeline')
  const [searchResults, setSearchResults] = useState<Array<{ url: string; title: string; description: string }>>([])
  const [currentQuery, setCurrentQuery] = useState<string>('')
  const startTime = events[0]?.timestamp || Date.now()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'searching') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status, startTime])

  // Collect all screenshots and search results from events
  useEffect(() => {
    const screenshots: Array<{ url: string; screenshot?: string }> = []
    const results: Array<{ url: string; title: string; description: string }> = []
    let query = ''
    
    events.forEach(event => {
      if (event.screenshots && event.screenshots.length > 0) {
        screenshots.push(...event.screenshots.filter(s => s.screenshot))
      }
      
      // Extract search query
      if (event.type === 'tool_call' && event.tool === 'web_search' && event.parameters?.query) {
        query = event.parameters.query as string
        setCurrentQuery(query)
      }
      
      // Parse search results from tool_result
      if (event.type === 'tool_result' && event.result) {
        const resultText = event.result
        // Parse search results from the text format
        const lines = resultText.split('\n')
        let currentResult: { url?: string; title?: string; description?: string } | null = null
        
        lines.forEach(line => {
          const urlMatch = line.match(/^\d+\.\s+(.+)$/)
          const titleMatch = line.match(/Title:\s+(.+)$/)
          const descMatch = line.match(/Description:\s+(.+)$/)
          
          if (urlMatch) {
            if (currentResult && currentResult.url && currentResult.title && currentResult.description) {
              results.push({
                url: currentResult.url,
                title: currentResult.title,
                description: currentResult.description
              })
            }
            currentResult = { url: urlMatch[1], title: 'Untitled', description: 'No description available' }
          } else if (titleMatch && currentResult) {
            currentResult.title = titleMatch[1]
          } else if (descMatch && currentResult) {
            currentResult.description = descMatch[1]
          }
        })
        
        if (currentResult) {
          const { url, title, description } = currentResult
          if (url && title && description && title !== 'Untitled' && description !== 'No description available') {
            results.push({ url, title, description })
          }
        }
      }
    })
    
    setAllScreenshots(screenshots)
    setSearchResults(results)
    
    // Only auto-switch to results view when search results are found (not for screenshots)
    if (results.length > 0 && viewMode === 'timeline' && screenshots.length === 0) {
      setViewMode('results')
    }
  }, [events, viewMode])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current && status === 'searching') {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [events, status])

  // Show response if complete
  if (status === 'complete' && response) {
    // Filter out the response event from the process display
    const processEvents = events.filter(e => e.type !== 'response');
    
    return (
      <div className="space-y-6">
        {/* Screenshots Gallery */}
        {allScreenshots.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="ui-subtitle mb-3 flex items-center gap-2 tabular-nums">
              <ImageIcon className="h-4 w-4" />
              Analyzed Pages ({allScreenshots.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {allScreenshots.map((screenshot, index) => (
                <div key={`${screenshot.url}-${index}`} style={{ animationDelay: `${index * 100}ms` }}>
                  <ScreenshotPreview
                    url={screenshot.url}
                    screenshot={screenshot.screenshot || ''}
                    className="animate-fade-in"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 min-h-[400px]">
          {/* Left side - Thinking process */}
          <div className="max-h-[600px] flex-1 overflow-y-auto border-r border-border pr-4">
            <div className="sticky top-0 bg-background pb-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="ui-subtitle">Research Process</h3>
                <div className="ui-caption flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{elapsedTime}s</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    <span>{events.filter(e => e.type === 'thinking').length} thoughts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    <span>{events.filter(e => e.type === 'tool_call').length} searches</span>
                  </div>
                  {allScreenshots.length > 0 && (
                    <div className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      <span>{allScreenshots.length} screenshots</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          <div className="space-y-2">
            {processEvents.map((event, index) => (
              <ThinkingEvent
                key={index}
                event={event}
                index={index}
                isExpanded={false}
                onToggle={() => {}}
                animationDelay={index * 60}
              />
            ))}
          </div>
        </div>

          {/* Right side - Final response */}
          <div className="flex-1 pl-4 overflow-y-auto max-h-[600px] opacity-0 animate-slide-in-right" style={{ animationDelay: `${processEvents.length * 60 + 200}ms`, animationFillMode: 'forwards' }}>
            <div>
              <h3 className="ui-title mb-4">Final Response</h3>
              <MarkdownRenderer content={response} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show live thinking process
  return (
    <div className="space-y-4">
      {/* Live status header */}
      <div className="flex items-center justify-between mb-4 animate-fade-in" style={{ animationDelay: '100ms', opacity: 0 }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-75" />
            <div className="relative w-2 h-2 bg-orange-500 rounded-full" />
          </div>
          <span className="ui-subtitle">
            Researching...
          </span>
        </div>
        <div className="ui-caption flex items-center gap-2">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="number-transition tabular-nums">{elapsedTime}s</span>
        </div>
      </div>

      {/* View mode tabs */}
      {(searchResults.length > 0 || allScreenshots.length > 0) && (
        <div className="mb-4 flex gap-1 border-b border-border">
          <button
            onClick={() => setViewMode('timeline')}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium tracking-[-0.006em] transition-colors",
              viewMode === 'timeline'
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Timeline
          </button>
          {searchResults.length > 0 && (
            <button
              onClick={() => setViewMode('results')}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium tracking-[-0.006em] tabular-nums transition-colors",
                viewMode === 'results'
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Search Results ({searchResults.length})
            </button>
          )}
          {allScreenshots.length > 0 && (
            <button
              onClick={() => setViewMode('screenshots')}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium tracking-[-0.006em] tabular-nums transition-colors",
                viewMode === 'screenshots'
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Screenshots ({allScreenshots.length})
            </button>
          )}
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'timeline' && (
        <div className="space-y-2">
          {events.map((event, index) => (
            <ThinkingEvent
              key={index}
              event={event}
              index={index}
              isExpanded={false}
              onToggle={() => {}}
              isLast={index === events.length - 1}
              isLive={status === 'searching'}
            animationDelay={index * 80}
          />
        ))}
        <div ref={scrollRef} />
        </div>
      )}

      {/* Search Results View */}
      {viewMode === 'results' && (
        <SearchResultsDisplay 
          results={searchResults} 
          query={currentQuery}
          isActive={status === 'searching'}
          screenshots={allScreenshots}
        />
      )}

      {/* Screenshots View */}
      {viewMode === 'screenshots' && (
        <div className="space-y-4">
          {allScreenshots.map((screenshot, idx) => (
            <ScreenshotPreview
              key={`${screenshot.url}-${idx}`}
              url={screenshot.url}
              screenshot={screenshot.screenshot || ''}
              isLoading={false}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ThinkingEventProps {
  event: ThinkingEvent
  index: number
  isExpanded: boolean
  onToggle: () => void
  isLast?: boolean
  isLive?: boolean
  animationDelay?: number
}

function ThinkingEvent({ event, index, isLast, isLive, animationDelay = 0 }: ThinkingEventProps) {
  const Icon = getEventIcon(event)
  const colorClass = getEventColor(event, index)
  const title = getEventTitle(event)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in animation after component mounts with a staggered delay
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, animationDelay * 0.5) // Faster stagger for smoother experience
    return () => clearTimeout(timer)
  }, [animationDelay])

  const isOdd = index % 2 === 1
  const bgClass = isOdd
    ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/25 dark:to-orange-900/15'
    : 'bg-gradient-to-r from-muted/50 to-muted/25'

  return (
    <div 
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-lg transition-all duration-700 ease-out",
        bgClass,
        "border border-border",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "hover:shadow-md hover:scale-[1.01] cursor-default"
      )}
    >
      <div className={cn("rounded-full bg-background p-2 shadow-sm", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="ui-subtitle min-w-0 truncate">
            {title}
          </h4>
          {event.duration && (
            <span className="ui-caption shrink-0 tabular-nums">
              {formatDuration(event.duration)}
            </span>
          )}
          {isLast && isLive && (
            <Loader2 className="h-3 w-3 text-orange-500 animate-spin" />
          )}
        </div>

        {/* Inline content for all events */}
        {event.type === 'tool_call' && event.parameters && (
          <p className="ui-caption mt-0.5 break-words">
            {(event.parameters.query as string) || (event.parameters.source_url as string)}
          </p>
        )}

        {event.type === 'thinking' && event.content && (
          <p className="ui-body mt-0.5 whitespace-pre-wrap text-muted-foreground">
            {event.content}
          </p>
        )}

        {event.type === 'tool_result' && event.result && (
          <p className="ui-caption mt-0.5 line-clamp-2 break-words">
            {event.result.length > 100
              ? event.result.substring(0, 100) + '...'
              : event.result}
          </p>
        )}

        {event.type === 'tool_result' && event.screenshots && event.screenshots.length > 0 && (
          <div className="mt-4 space-y-3">
            {event.screenshots.map((screenshot, idx) => (
              screenshot.screenshot && (
                <div key={`${screenshot.url}-${idx}`} className="relative">
                  <ScreenshotPreview
                    url={screenshot.url}
                    screenshot={screenshot.screenshot}
                    isLoading={isLast && isLive}
                    className="w-full"
                  />
                  {isLast && isLive && (
                    <div className="ui-mono absolute right-2 top-2 z-10 animate-pulse rounded-md bg-black/80 px-3 py-1 text-white">
                      <span>Analyzing page content...</span>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        )}

        {event.type === 'summary' && (
          <p className="ui-caption mt-0.5">
            {event.thinkingBlocks} thinking blocks, {event.toolCalls} tool calls
          </p>
        )}
      </div>

    </div>
  )
}