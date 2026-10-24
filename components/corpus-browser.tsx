'use client'

import { useEffect, useState } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchDatasets,
  groupDatasets,
  displayTitle,
  displayNameFor,
  type DatasetInfo,
} from '@/components/corpus/datasets'

interface CorpusHit {
  dataset: string
  citation: string
  title: string
  url: string
  snippet: string
  score: number
}

/**
 * Browse the corpus directly, no agent involved. Built in the chat's own
 * visual language: the same white card on the charcoal band, the same chips
 * as the chat's suggestions, the same type sizes as its answers, so search
 * and chat read as one tool. Dataset names and source titles are shown in
 * sentence case; the stored titles are all caps.
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
    <>
      <section className="bg-[#22364a] px-6 pb-16 pt-16 dark:bg-[#141f2b] sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
            Browse the corpus
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-300">
            The California codes, the Rules of Court and the Judicial Council
            forms held on this site. Pick a dataset to search inside it, or
            search across all of them at once.
          </p>

          <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white shadow-xs dark:border-white/[0.09] dark:bg-[#0B0B0D]">
            <form
              onSubmit={runSearch}
              className="flex items-center gap-2 border-b border-black/[0.06] px-3.5 py-2.5 dark:border-white/[0.07]"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  selectedInfo
                    ? `Search the ${selectedInfo.name}`
                    : 'Search every dataset, for example: security deposit'
                }
                className="min-w-0 flex-1 bg-transparent px-1.5 text-[15px] text-neutral-900 outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                aria-label="Search the corpus"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </form>

            <div className="space-y-4 px-3.5 py-4">
              {groupDatasets(datasets).map(({ group, items }) => (
                <div key={group}>
                  <p className="px-1.5 text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
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
                          <span
                            className={cn(
                              'ml-1.5 tabular-nums',
                              active ? 'text-white/60' : 'text-neutral-400',
                            )}
                          >
                            {d.rows.toLocaleString()}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pb-24">
          {error && (
            <p className="pt-10 text-[14px] text-red-700 dark:text-red-400">{error}</p>
          )}

          {hits !== null && !error && (
            <div className="pt-10">
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                {hits.length === 0
                  ? 'No matching records.'
                  : `${hits.length} result${hits.length === 1 ? '' : 's'}${selectedInfo ? ` in the ${selectedInfo.name}` : ''}`}
              </p>
              <ul className="mt-2 divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                {hits.map((hit, i) => (
                  <li key={`${hit.dataset}-${hit.citation}-${i}`} className="py-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">
                        {hit.citation || displayTitle(hit.title)}
                      </span>
                      <span className="rounded bg-[#a5811f]/10 px-1.5 py-0.5 text-[11px] text-[#a5811f] dark:text-[#d3ab55]">
                        {displayNameFor(hit.dataset)}
                      </span>
                    </div>
                    {hit.title && hit.citation && (
                      <p className="mt-0.5 text-[13.5px] text-neutral-500 dark:text-neutral-400">
                        {displayTitle(hit.title)}
                      </p>
                    )}
                    <p className="mt-2 text-[14.5px] leading-[1.7] text-neutral-600 dark:text-neutral-300">
                      {hit.snippet}
                    </p>
                    {hit.url && (
                      <a
                        href={hit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-block text-[13px] text-[#a5811f] underline underline-offset-4 dark:text-[#d3ab55]"
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
      </section>
    </>
  )
}
