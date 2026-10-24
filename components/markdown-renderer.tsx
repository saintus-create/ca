'use client';

import { memo } from 'react';
import { CitationTooltip } from '@/components/citation-tooltip';
import { renderMarkdown } from '@/lib/markdown';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  sources?: Array<{ url: string; title: string; description?: string }>;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  streaming = false,
  sources = [],
}: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      {streaming && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-[0.5ch] animate-pulse bg-[#8a6d1a] align-baseline"
        />
      )}
      {sources.length > 0 && <CitationTooltip sources={sources} />}
    </div>
  );
});
