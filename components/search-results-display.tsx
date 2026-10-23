'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, Search, FileText, Image, Scale, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedCursor } from './animated-cursor'
import { BorderBeam } from '@/components/velora/border-beam'

interface SearchResult {
  title: string
  url: string
  description?: string
  markdown?: string
  screenshot?: string
  dateFound?: string
}

interface SearchHistory {
  query: string
  results: SearchResult[]
  screenshots: Array<{ url: string; screenshot?: string }>
  timestamp: number
}

interface SearchResultsDisplayProps {
  query?: string
  results?: SearchResult[]
  isActive?: boolean
  currentUrl?: string
  screenshots?: Array<{ url: string; screenshot?: string }>
  onClose?: () => void
}

export function SearchResultsDisplay({ 
  query = '', 
  results = [], 
  isActive = false,
  currentUrl = '',
  screenshots = [],
  onClose
}: SearchResultsDisplayProps) {
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [viewMode, setViewMode] = useState<'search' | 'screenshots' | 'history'>('search')
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0)
  const [isImageTall, setIsImageTall] = useState(false)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showClosingAnimation, setShowClosingAnimation] = useState(false)
  const [browserClosed, setBrowserClosed] = useState(false)
  const closeButtonRef = useRef<HTMLDivElement>(null)
  const browserContainerRef = useRef<HTMLDivElement>(null)
  const screenshotRef = useRef<HTMLImageElement>(null)
  
  // Save search history when search completes
  useEffect(() => {
    if (!isActive && query && results.length > 0) {
      // Check if this search is already in history (avoid duplicates)
      const existingIndex = searchHistory.findIndex(h => h.query === query)
      if (existingIndex === -1) {
        const newHistory: SearchHistory = {
          query,
          results: [...results],
          screenshots: [...screenshots],
          timestamp: Date.now()
        }
        setSearchHistory(prev => [...prev, newHistory])
      }
      
      // Trigger closing animation after search completes
      setTimeout(() => {
        setShowClosingAnimation(true)
      }, 2000) // Wait 2 seconds after search completes
    }
  }, [isActive, query, results.length, screenshots.length])
  
  // Switch to history view when search completes and we have history
  useEffect(() => {
    if (!isActive && searchHistory.length > 0) {
      setViewMode('history')
    }
  }, [isActive, searchHistory.length])

  // Show screenshot only when actively scraping a specific URL
  useEffect(() => {
    if (isActive && currentUrl && currentUrl !== '' && screenshots.length > 0) {
      // Always use the latest screenshot when scraping
      // This handles cases where the same URL is scraped multiple times
      const latestScreenshot = screenshots[screenshots.length - 1]
      
      // Check if this is the URL being scraped or if it's the latest screenshot
      const currentScreenshotData = screenshots.find(s => s.url === currentUrl) || latestScreenshot
      
      if (currentScreenshotData?.screenshot) {
        // Small delay to ensure smooth transition
        setTimeout(() => {
          // Reset loading state when changing screenshots
          setIsImageLoaded(false)
          setIsImageTall(false)
          // Show the screenshot for the page being scraped
          setCurrentScreenshot(currentScreenshotData.screenshot || null)
          setShowScreenshot(true)
        }, 150)
      } else {
        // No screenshot for current URL, show search results
        setShowScreenshot(false)
      }
    } else {
      // Not scraping a specific URL, show search results
      setShowScreenshot(false)
      setCurrentScreenshot(null)
      setIsImageLoaded(false)
      setIsImageTall(false)
    }
  }, [currentUrl, screenshots, isActive])

  // Highlight results as they're being scraped
  useEffect(() => {
    if (currentUrl && results.length > 0) {
      const index = results.findIndex(r => r.url === currentUrl)
      setActiveResultIndex(index)
    } else {
      setActiveResultIndex(-1)
    }
  }, [currentUrl, results])

  const getUrlBarContent = () => {
    // Prioritize showing scraping URL when actively scraping
    if (currentUrl && isActive) {
      return {
        icon: <FileText className="h-4 w-4" />,
        text: currentUrl,
        action: 'scraping'
      }
    }
    // Show search query when we have results or are searching
    if (query && (results.length > 0 || isActive)) {
      return {
        icon: <Search className="h-4 w-4" />,
        text: `Searching: ${query}`,
        action: 'searching'
      }
    }
    // Default to search if we have a query
    if (query) {
      return {
        icon: <Search className="h-4 w-4" />,
        text: `Searching: ${query}`,
        action: isActive ? 'searching' : 'idle'
      }
    }
    return {
      icon: <Globe className="h-4 w-4" />,
      text: '',
      action: 'idle'
    }
  }

  const urlBar = getUrlBarContent()

  return (
    <div 
      ref={browserContainerRef}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg transition-all duration-500",
        browserClosed && "opacity-0 scale-95 translate-x-full"
      )}
    >
      {isActive && <BorderBeam size={200} duration={8} />}
      {/* Animated cursor - positioned inside the browser container */}
      {showClosingAnimation && closeButtonRef.current && browserContainerRef.current && (
        <AnimatedCursor
          targetX={closeButtonRef.current.getBoundingClientRect().left + closeButtonRef.current.offsetWidth / 2}
          targetY={closeButtonRef.current.getBoundingClientRect().top + closeButtonRef.current.offsetHeight / 2}
          containerRef={browserContainerRef as React.RefObject<HTMLElement>}
          onComplete={() => {
            setBrowserClosed(true)
            setTimeout(() => {
              onClose?.()
            }, 500) // Wait for browser close animation
          }}
          delay={500}
        />
      )}
      
      {/* Fake browser URL bar */}
      <div className="flex-shrink-0 border-b border-border bg-muted px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div 
              ref={closeButtonRef} 
              className={cn(
                "w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer transition-all duration-300",
                showClosingAnimation && "animate-button-press"
              )}
            />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-background px-3 py-1">
            {urlBar.icon}
            <span className="ui-mono min-w-0 flex-1 truncate text-muted-foreground">
              {urlBar.text}
            </span>
            {urlBar.action === 'searching' && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <div className="w-2 h-2 bg-brand-to rounded-full animate-pulse" />
                <span className="ui-caption whitespace-nowrap text-brand-to">Searching...</span>
              </div>
            )}
            {urlBar.action === 'scraping' && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                <span className="ui-caption whitespace-nowrap text-brand">Scraping...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search results display */}
      <div className="flex-1 overflow-hidden relative">
        {(viewMode === 'search' && showScreenshot && currentScreenshot) ? (
          <div className="absolute inset-0 flex">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
              {/* Loading state for image */}
              {!isImageLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="ui-body text-muted-foreground">Loading page...</p>
                  </div>
                </div>
              )}
              
              {/* Scrolling container for long screenshots */}
              <div className="absolute inset-0 overflow-hidden">
                <div className={cn(
                  "screenshot-scroll-container transition-opacity duration-500",
                  isImageTall && isImageLoaded && "animate-screenshot-scroll",
                  isImageLoaded ? "opacity-100" : "opacity-0"
                )}>
                  <img 
                    ref={screenshotRef}
                    src={currentScreenshot} 
                    alt="Screenshot" 
                    className={cn(
                      "w-full",
                      isImageTall ? "object-cover object-top" : "object-contain h-full"
                    )}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      const containerHeight = img.parentElement?.parentElement?.clientHeight || 0;
                      const imageHeight = img.naturalHeight * (img.clientWidth / img.naturalWidth);
                      setIsImageTall(imageHeight > containerHeight * 1.5); // Image is tall if it's 1.5x the container height
                      
                      // Add a small delay to ensure smooth transition
                      setTimeout(() => {
                        setIsImageLoaded(true);
                      }, 100);
                    }}
                  />
                </div>
                {/* Fade gradients for smooth scrolling effect */}
                {isImageTall && isImageLoaded && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white dark:from-gray-900 to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none" />
                  </>
                )}
              </div>
              {/* Scanner effect overlay - only show when image is loaded */}
              {isImageLoaded && (
                <div className="absolute inset-0 pointer-events-none animate-fade-in">
                  <div className="scanner-line" />
                  {/* Grid overlay effect */}
                  <div className="absolute inset-0" style={{
                  backgroundImage: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 40px,
                    rgba(251, 146, 60, 0.03) 40px,
                    rgba(251, 146, 60, 0.03) 41px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 40px,
                    rgba(251, 146, 60, 0.03) 40px,
                    rgba(251, 146, 60, 0.03) 41px
                  )`
                }} />
                </div>
              )}
              {isImageLoaded && (
                <div className="absolute bottom-6 right-6 bg-card border-2 border-brand text-brand-to px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-up">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="ui-subtitle font-medium">Scanning page content</span>
                </div>
              )}
            </div>
          </div>
        ) : (viewMode === 'search' || viewMode === 'history') && !showScreenshot ? (
          <div className="flex h-full flex-col bg-background">
            {/* Google-style search header - always show when we have results */}
            {(query || results.length > 0) && (
              <div className="border-b border-border bg-background px-3 py-2 lg:px-6 lg:py-3">
                <div className="flex items-center gap-3 lg:gap-8">
                  {/* Brand wordmark for the mock results page */}
                  <span className="flex flex-shrink-0 items-center gap-2 text-[15px] font-medium lg:text-base">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background lg:h-7 lg:w-7">
                      <Scale className="h-3.5 w-3.5" />
                    </span>
                    California Law
                  </span>
                  
                  {/* Search box */}
                  <div className="flex-1 max-w-[400px]">
                    <div className="flex items-center rounded-full border border-border bg-card px-3 py-2 shadow-sm transition-shadow hover:shadow-md lg:px-5 lg:py-2.5">
                      <span className="ui-body min-w-0 flex-1 truncate text-foreground/90">
                        <span className="lg:hidden">{query ? (query.length > 30 ? query.substring(0, 30) + '...' : query) : 'Search...'}</span>
                        <span className="hidden lg:inline">{query || 'Search...'}</span>
                      </span>
                      <div className="ml-2 lg:ml-3 p-1 flex-shrink-0">
                        <Search className="h-4 w-4 lg:h-5 lg:w-5 text-brand-to" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search results in Google style */}
            <div className="flex-1 overflow-y-auto px-6">
              <div className="max-w-[500px] py-4">
                {/* Results count */}
                {query && results.length > 0 && !isActive && (
                  <div className="ui-caption mb-3">
                    About {results.length} results
                  </div>
                )}

                {/* Search results */}
                <div className="space-y-6">
                {results.map((result, index) => {
                  // Corpus hits cite a statute rather than a page, so there is
                  // no URL to parse — the citation itself is the identifier.
                  let hostname = 'California corpus'
                  let urlPath = ''
                  try {
                    hostname = new URL(result.url).hostname
                    urlPath = result.url.split('/').slice(3).filter(Boolean).join(' › ')
                  } catch {
                    hostname = (result.title || 'California corpus').split('—')[0].trim()
                  }
                  
                  return (
                    <div key={index} className="group">
                      {/* Site info - simple text without logo */}
                      <div className="ui-caption mb-1 truncate">
                        <cite className="not-italic">
                          {hostname}
                          {urlPath && <span> › {urlPath}</span>}
                        </cite>
                      </div>

                      {/* Title */}
                      <h3 className="mb-1">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ui-title block text-blue-700 underline-offset-2 hover:underline visited:text-purple-700 dark:text-blue-400 dark:visited:text-purple-400"
                        >
                          {result.title}
                        </a>
                      </h3>

                      {/* Date and description */}
                      <div className="ui-body text-foreground/80">
                        {result.dateFound && (
                          <span className="text-muted-foreground">{result.dateFound} · </span>
                        )}
                        <span className="[text-wrap:pretty]">{result.description}</span>
                      </div>

                      {/* Scraping indicator */}
                      {activeResultIndex === index && (
                        <div className="ui-caption mt-2 inline-flex items-center gap-2 rounded border-2 border-dashed border-brand px-3 py-1 text-brand-to animate-selection-pulse-green">
                          <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                          <span>Analyzing this page...</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* No results message */}
                {results.length === 0 && query && !isActive && (
                  <div className="py-8">
                    <p className="ui-body">
                      Your search - <span className="font-medium text-foreground">{query}</span> - did not match any documents.
                    </p>
                    <div className="mt-4">
                      <p className="ui-subtitle mb-2">Suggestions:</p>
                      <div className="ui-body space-y-1 text-muted-foreground">
                        {['Make sure all words are spelled correctly.', 'Try different keywords.', 'Try more general keywords.'].map((suggestion) => (
                          <div key={suggestion} className="flex items-start gap-1.5">
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
                            <span>{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading state - removed to go directly to search results */}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'screenshots' && !isActive ? (
          <div className="h-full overflow-hidden flex flex-col">
            {/* Screenshot viewer */}
            <div className="flex-1 overflow-hidden bg-background">
              {screenshots.length > 0 && screenshots[selectedScreenshotIndex]?.screenshot ? (
                <img 
                  src={screenshots[selectedScreenshotIndex].screenshot} 
                  alt={`Screenshot from ${screenshots[selectedScreenshotIndex].url}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Image className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="ui-body">No screenshots available</p>
                </div>
              )}
            </div>
            
            {/* Screenshot thumbnails */}
            {screenshots.length > 0 && (
              <div className="border-t border-border bg-card p-4">
                <div className="flex gap-2 overflow-x-auto">
                  {screenshots.map((screenshot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedScreenshotIndex(index)}
                      className={cn(
                        "flex-shrink-0 relative rounded-lg overflow-hidden transition-all",
                        selectedScreenshotIndex === index
                          ? "ring-2 ring-brand"
                          : "opacity-70 hover:opacity-100"
                      )}
                    >
                      <img 
                        src={screenshot.screenshot || ''} 
                        alt={`Thumbnail ${index + 1}`}
                        className="h-16 w-24 object-contain bg-muted"
                      />
                      <div className="ui-caption absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-white">
                        {new URL(screenshot.url).hostname}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}