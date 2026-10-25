'use client';

import { useState, useRef, useEffect } from 'react';

interface Source {
  url: string;
  title: string;
  description?: string;
}

interface CitationTooltipProps {
  sources: Source[];
}

export function CitationTooltip({ sources }: CitationTooltipProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; source: Source } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const showFor = (target: HTMLElement) => {
      const citationText = target.textContent?.match(/\d+/)?.[0];
      if (!citationText) return;
      const source = sources[parseInt(citationText) - 1];
      if (!source) return;
      const rect = target.getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        source,
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SUP' && target.className.includes('citation')) {
        showFor(target);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SUP' && target.className.includes('citation')) {
        timeoutRef.current = setTimeout(() => {
          setTooltip(null);
        }, 200);
      }
    };

    // Touch devices have no hover, so a tap on a citation toggles its card.
    // A tap anywhere else closes it.
    const handleClick = (e: MouseEvent) => {
      if (!window.matchMedia('(pointer: coarse)').matches) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'SUP' && target.className.includes('citation')) {
        setTooltip((current) => {
          const citationText = target.textContent?.match(/\d+/)?.[0];
          const source = citationText ? sources[parseInt(citationText) - 1] : undefined;
          if (current && source && current.source === source) return null;
          if (!source) return current;
          const rect = target.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top, source };
        });
      } else {
        setTooltip(null);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [sources]);

  if (!tooltip) return null;

  const maxUrlLength = 50;
  const displayUrl = tooltip.source.url.length > maxUrlLength
    ? tooltip.source.url.substring(0, maxUrlLength) + '...'
    : tooltip.source.url;

  // Keep the card on screen: half its width, clamped to the viewport.
  const halfWidth = Math.min(192, (window.innerWidth - 32) / 2);
  const clampedX = Math.min(Math.max(tooltip.x, halfWidth + 8), window.innerWidth - halfWidth - 8);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: clampedX,
        top: tooltip.y - 8,
        transform: 'translate(-50%, -100%)',
      }}
      onMouseEnter={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="pointer-events-auto max-w-[calc(100vw-2rem)] w-sm rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xs">
        <p className="ui-subtitle break-words">
          {tooltip.source.title}
        </p>
        <p className="ui-caption mt-1 break-all">
          {displayUrl}
        </p>
        {tooltip.source.description && (
          <p className="ui-caption mt-2 line-clamp-2 break-words">
            {tooltip.source.description}
          </p>
        )}
      </div>
      {/* Arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
        <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-popover" />
      </div>
    </div>
  );
}
