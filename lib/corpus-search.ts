// California Legislative Information corpus search.
//
// Reads the cleaned, unified corpus that lives in public/corpus as
// base64-encoded gzipped JSONL assets (see public/corpus/manifest.json,
// whose "assets" map lists the file(s) for each dataset; large datasets
// are split into .b64.partNNN chunks of one base64 stream). Datasets are
// decoded and cached on first use. This module is the data side of the
// California Law template: the agent reaches the corpus through the
// search_california_law tool, exactly the way it reaches the web
// through Firecrawl.

import { readFile } from 'fs/promises';
import path from 'path';
import { gunzipSync } from 'zlib';

export interface CorpusRecord {
  citation: string;
  title: string;
  text: string;
  url?: string;
}

export interface CorpusHit {
  dataset: string;
  citation: string;
  title: string;
  url?: string;
  snippet: string;
  /** The record's own text (first 3000 chars), so a reader, human or model,
   *  sees the section itself and not only a window around the match. */
  text: string;
  fullLength: number;
  score: number;
}


const ACRONYMS = new Set(['DUI', 'DMV', 'DNA', 'HIV', 'AIDS', 'ADA', 'IRS', 'FBI', 'DOJ', 'OSHA', 'EPA', 'FTB', 'EDD', 'CHP'])

/** Corpus source titles are stored in all caps. For display, a title that is
 *  mostly uppercase is sentence cased; anything already mixed case is left
 *  exactly as written. */
function displayTitle(title: string): string {
  if (!title) return title
  const letters = title.replace(/[^A-Za-z]/g, '')
  if (letters.length < 8) return title
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.8) return title
  const lowered = title.toLowerCase().replace(/\b([a-z])/, (m) => m.toUpperCase())
  return lowered.replace(/\b([a-z]{2,})\b/g, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w))
}

interface Manifest {
  assets: Record<string, string[]>;
}

const CORPUS_DIR = path.join(process.cwd(), 'public', 'corpus');

let manifestCache: Manifest | null = null;
const datasetCache = new Map<string, CorpusRecord[]>();

async function readCorpusFile(rel: string): Promise<string> {
  // Preferred: the filesystem (local runs and any host with the repo on
  // disk). On serverless hosts public/ files are served as static
  // assets but are NOT present inside the function, so fall back to
  // fetching the file over HTTP from, in order: an explicit override,
  // this deployment's own production URL, and its deployment URL.
  //
  // Deliberately no third-party fallback: the corpus must come from this
  // deployment, never from an external repository, or the app would keep
  // working off a copy it does not control.
  try {
    return await readFile(path.join(CORPUS_DIR, rel), 'utf8');
  } catch {
    // fall through to HTTP
  }
  const bases: string[] = [];
  if (process.env.CORPUS_BASE_URL) bases.push(process.env.CORPUS_BASE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    bases.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.VERCEL_URL) bases.push(`https://${process.env.VERCEL_URL}`);

  let lastError: unknown = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/corpus/${rel}`);
      if (res.ok) return await res.text();
      lastError = new Error(`${base}/corpus/${rel} -> HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(
    `corpus file unavailable: ${rel} (${lastError instanceof Error ? lastError.message : 'no source reachable'})`
  );
}

async function loadManifest(): Promise<Manifest> {
  if (!manifestCache) {
    const raw = await readCorpusFile('manifest.json');
    manifestCache = JSON.parse(raw) as Manifest;
  }
  return manifestCache;
}

// "law/PEN.jsonl.gz" -> "PEN"; "cases/FAM_CASES.jsonl.gz" -> "FAM_CASES"
function codeOf(assetKey: string): string {
  const base = assetKey.split('/').pop() || assetKey;
  return base.replace(/\.jsonl\.gz$/, '').replace(/\.json\.gz$/, '');
}

async function loadDataset(assetKey: string): Promise<CorpusRecord[]> {
  const cached = datasetCache.get(assetKey);
  if (cached) return cached;

  const manifest = await loadManifest();
  const files = manifest.assets[assetKey];
  if (!files || files.length === 0) return [];

  let b64 = '';
  for (const f of files) {
    b64 += await readCorpusFile(f);
  }
  const text = gunzipSync(Buffer.from(b64.trim(), 'base64')).toString('utf8');

  const records: CorpusRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      records.push({
        citation: r.citation || '',
        title: r.title || '',
        text: r.text || '',
        url: r.url || undefined,
      });
    } catch {
      // skip malformed line (cleaning flags these upstream; never fatal)
    }
  }
  datasetCache.set(assetKey, records);
  return records;
}

function queryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[§]/g, ' ')
        .split(/[^a-z0-9.]+/)
        .filter((t) => t.length >= 2 || /^\d+$/.test(t))
    )
  );
}

function snippetAround(text: string, terms: string[], width = 700): string {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return text.slice(0, width);
  const start = Math.max(0, idx - 120);
  const out = text.slice(start, start + width);
  return (start > 0 ? '...' : '') + out + (start + width < text.length ? '...' : '');
}

function scoreRecord(rec: CorpusRecord, terms: string[]): number {
  const citation = rec.citation.toLowerCase();
  const title = rec.title.toLowerCase();
  const text = rec.text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (citation.includes(t)) score += 10;
    if (title.includes(t)) score += 5;
    let i = text.indexOf(t);
    let n = 0;
    while (i >= 0 && n < 4) {
      score += 1;
      n++;
      i = text.indexOf(t, i + t.length);
    }
  }
  return score;
}

// Resolve which dataset asset keys to search. A specific code ("PEN",
// "FAM_CASES", or a full key like "law/PEN") limits the search to that
// dataset; otherwise codes come first, then rules, cases, legislation,
// forms, and directory, stopping early once enough strong hits exist.
async function targetKeys(datasetCode?: string): Promise<string[]> {
  const manifest = await loadManifest();
  const keys = Object.keys(manifest.assets);
  if (datasetCode) {
    const want = datasetCode.trim().toLowerCase();
    const hit = keys.filter(
      (k) => codeOf(k).toLowerCase() === want || k.toLowerCase() === want || k.toLowerCase() === `${want}.jsonl.gz`
    );
    if (hit.length > 0) return hit;
  }
  const rank = (k: string) =>
    k.startsWith('law/') ? 0 : k.startsWith('rules/') ? 1 : k.startsWith('cases/') ? 2 : k.startsWith('legislation/') ? 3 : k.startsWith('forms/') ? 4 : 5;
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

export async function searchCorpus(query: string, datasetCode?: string, limit = 5): Promise<CorpusHit[]> {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const keys = await targetKeys(datasetCode);
  const hits: CorpusHit[] = [];

  for (const key of keys) {
    const records = await loadDataset(key);
    for (const rec of records) {
      const score = scoreRecord(rec, terms);
      if (score > 0) {
        hits.push({
          dataset: codeOf(key),
          citation: rec.citation,
          title: rec.title,
          url: rec.url,
          snippet: snippetAround(rec.text, terms),
          text: rec.text.slice(0, 3000),
          fullLength: rec.text.length,
          score,
        });
      }
    }
    // With no specific dataset requested, stop once we have plenty.
    if (!datasetCode && hits.length >= limit * 4) break;
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export async function executeCorpusSearch(
  query: string,
  datasetCode?: string,
  limit = 5
): Promise<{ content: string }> {
  try {
    const hits = await searchCorpus(query, datasetCode, limit);
    if (hits.length === 0) {
      return { content: 'No matching records found in the California Legislative Information corpus.' };
    }
    const lines = hits.map((h, i) => {
      const head = `[${i + 1}] ${h.citation || displayTitle(h.title)}, ${h.dataset}${h.title && h.citation ? `: ${displayTitle(h.title)}` : ''}${
        h.url ? `\nSource: ${h.url}` : ''
      }`;
      // Give the model the section text, not just the window around the
      // match. When the record runs past the carried text and the match sits
      // beyond it, include the match window too.
      let body = h.text;
      if (h.fullLength > h.text.length && !h.text.includes(h.snippet.replace(/^\.\.\.|\.\.\.$/g, '').slice(0, 60))) {
        body = `${h.text}\n[match window] ${h.snippet}`;
      }
      return `${head}\n${body}`;
    });
    return {
      content: `California Legislative Information corpus results for "${query}":\n\n${lines.join('\n\n')}`,
    };
  } catch (error) {
    return {
      content: `Error searching California corpus: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
