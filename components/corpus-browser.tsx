'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchDatasets, groupDatasets, type DatasetInfo } from '@/components/corpus/datasets'

interface CorpusHit {
  dataset: string
  citation: string
  title: string
  url: string
  snippet: string
  score: number
}

/**
 * Browse the corpus directly, no agent involved: pick a dataset from the
 * manifest, or search across all of them, through /api/corpus-search.
 */
export function CorpusBrowser() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [selected, setSelected] = useState<string>('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<CorpusHit[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch(() => setError('The corpus index could not be loaded.'))
  }, [])

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim() || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '25' })
      if (selected) params.set('dataset', selected)
      const res = await fetch(`/api/corpus-search?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setHits(data.hits || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setHits(null)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedInfo = datasets.find((d) => d.code === selected)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
      <form onSubmit={runSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            selectedInfo
              ? `Search the ${selectedInfo.name}`
              : 'Search every dataset, for example: retroactive, security deposit, hearsay'
          }
          className="h-12 w-full rounded-full border border-black/[0.08] bg-white pl-5 pr-14 text-[15px] text-neutral-900 shadow-xs outline-hidden placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-white/[0.09] dark:bg-[#0B0B0D] dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          aria-label="Search the corpus"
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      <div className="mt-8 space-y-6">
        {groupDatasets(datasets).map(({ group, items }) => (
          <div key={group}>
            <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
              {group}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map((d) => {
                const active = selected === d.code
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => setSelected(active ? '' : d.code)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[12.5px] transition-colors',
                      active
                        ? 'border-transparent bg-[#22364a] text-white dark:bg-[#33506b]'
                        : 'border-black/[0.08] bg-white text-neutral-600 hover:border-black/[0.16] hover:text-neutral-900 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-neutral-300 dark:hover:text-neutral-50',
                    )}
                  >
                    {d.name}
                    <span className={cn('ml-1.5 tabular-nums', active ? 'text-white/60' : 'text-neutral-400')}>
                      {d.rows.toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-10 text-[13.5px] text-red-700 dark:text-red-400">{error}</p>
      )}

      {hits !== null && !error && (
        <div className="mt-10">
          <p className="text-[12.5px] text-neutral-400 dark:text-neutral-500">
            {hits.length === 0
              ? 'No matching records.'
              : `${hits.length} result${hits.length === 1 ? '' : 's'}${selectedInfo ? ` in the ${selectedInfo.name}` : ''}`}
          </p>
          <ul className="mt-3 divide-y divide-black/[0.06] dark:divide-white/[0.07]">
            {hits.map((hit, i) => (
              <li key={`${hit.dataset}-${hit.citation}-${i}`} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[14px] font-medium text-neutral-900 dark:text-neutral-50">
                    {hit.citation || hit.title}
                  </span>
                  <span className="rounded bg-[#a5811f]/10 px-1.5 py-0.5 font-mono text-[10.5px] text-[#a5811f] dark:text-[#d3ab55]">
                    {hit.dataset}
                  </span>
                </div>
                {hit.title && hit.citation && (
                  <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">{hit.title}</p>
                )}
                <p className="mt-1.5 text-[13.5px] leading-[1.65] text-neutral-600 dark:text-neutral-300">
                  {hit.snippet}
                </p>
                {hit.url && (
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[12.5px] text-[#a5811f] underline underline-offset-4 dark:text-[#d3ab55]"
                  >
                    {hit.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
