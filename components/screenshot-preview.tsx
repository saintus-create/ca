'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { 
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Expand, X } from 'lucide-react'

interface ScreenshotPreviewProps {
  url: string
  screenshot: string
  isLoading?: boolean
  className?: string
}

export function ScreenshotPreview({ url, screenshot, isLoading = false, className }: ScreenshotPreviewProps) {
  const [showModal, setShowModal] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)

  // Preload image before showing
  useEffect(() => {
    if (screenshot && typeof window !== 'undefined') {
      const img = document.createElement('img')
      img.onload = () => {
        // Small delay to ensure smooth animation
        setTimeout(() => setImageLoaded(true), 100)
      }
      img.onerror = () => {
        // Failed to preload screenshot
        setImageLoaded(true)
      }
      img.src = screenshot
    }
  }, [screenshot, url])

  // Animate scan progress when loading
  useEffect(() => {
    if (isLoading && scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress(prev => Math.min(prev + 5, 100))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading, scanProgress])

  // Reset scan progress when loading changes
  useEffect(() => {
    if (isLoading) {
      setScanProgress(0)
    }
  }, [isLoading])

  return (
    <>
      <div 
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-muted",
          "transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
          className
        )}
        onClick={() => setShowModal(true)}
      >
        {/* Screenshot thumbnail */}
        <div className="relative aspect-video">
          {screenshot && (
            <Image
              src={screenshot}
              alt={`Screenshot of ${url}`}
              fill
              className={cn(
                "object-cover transition-opacity duration-500",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => {}}
              onError={() => { /* Failed to load screenshot */ }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
          
          {/* Loading state with scanning animation */}
          {(!imageLoaded || !screenshot) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          )}

          {/* Scanning overlay animation - only show after image is loaded */}
          {isLoading && imageLoaded && screenshot && (
            <>
              {/* Scan line effect */}
              <div 
                className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-orange-500 to-transparent opacity-80 animate-scan"
                style={{
                  top: `${scanProgress}%`,
                  boxShadow: '0 0 20px 5px rgba(251, 146, 60, 0.5)'
                }}
              />
              
              {/* Grid overlay */}
              <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat opacity-20 animate-pulse" />
              
              {/* Corner indicators */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-orange-500 animate-pulse" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-orange-500 animate-pulse" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-orange-500 animate-pulse" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-orange-500 animate-pulse" />
            </>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <Expand className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>

        {/* URL label */}
        <div className="border-t border-border bg-card p-2">
          <p className="ui-caption truncate">
            {new URL(url).hostname}
          </p>
        </div>
      </div>

      {/* Full-size modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Screenshot of {url}</DialogTitle>
          
          {/* Modal header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="mr-4 min-w-0 flex-1">
              <p className="ui-subtitle truncate">
                {url}
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal body with full screenshot */}
          <div className="relative h-full w-full overflow-auto bg-muted/40">
            {screenshot && (
              <div className="relative min-h-[500px]">
                <Image
                  src={screenshot}
                  alt={`Screenshot of ${url}`}
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                  priority
                />
                
                {/* Scanning animation in modal */}
                {isLoading && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Animated scan grid */}
                    <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-orange-500/10 animate-scan-vertical" />
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-transparent to-orange-500/10 animate-scan-horizontal" />
                    
                    {/* Analyzing text */}
                    <div className="ui-mono absolute left-4 top-4 rounded-md bg-black/80 px-3 py-1 text-white">
                      <span className="animate-pulse">Analyzing page content...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}