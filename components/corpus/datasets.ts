/**
 * Client-side view of the corpus manifest: dataset codes, display names and
 * groups, derived from /corpus/manifest.json so the list never drifts from
 * what is actually on the site.
 */
export interface DatasetInfo {
  code: string
  name: string
  group: string
  rows: number
  file: string
}

const NAMES: Record<string, string> = {
  BPC: 'Business and Professions Code',
  CCP: 'Code of Civil Procedure',
  CIV: 'Civil Code',
  COM: 'Commercial Code',
  CONS: 'California Constitution',
  CORP: 'Corporations Code',
  EDC: 'Education Code',
  ELEC: 'Elections Code',
  EVID: 'Evidence Code',
  FAC: 'Food and Agricultural Code',
  FAM: 'Family Code',
  FGC: 'Fish and Game Code',
  FIN: 'Financial Code',
  GOV: 'Government Code',
  HNC: 'Harbors and Navigation Code',
  HSC: 'Health and Safety Code',
  INS: 'Insurance Code',
  LAB: 'Labor Code',
  MVC: 'Military and Veterans Code',
  PCC: 'Public Contract Code',
  PEN: 'Penal Code',
  PRC: 'Public Resources Code',
  PROB: 'Probate Code',
  PUC: 'Public Utilities Code',
  RTC: 'Revenue and Taxation Code',
  SHC: 'Streets and Highways Code',
  UIC: 'Unemployment Insurance Code',
  VEH: 'Vehicle Code',
  WAT: 'Water Code',
  WIC: 'Welfare and Institutions Code',
  ROC: 'California Rules of Court',
  FORMS: 'Judicial Council Forms',
  BILLS: 'Legislation',
  FAM_CASES: 'Family Case Annotations',
  DIRECTORY: 'Agency Directory',
  'wp-digest': "West's California Digest",
  WPDIGEST: "West's California Digest",
}

const GROUPS: Record<string, string> = {
  law: 'Codes',
  rules: 'Court rules',
  forms: 'Forms',
  legislation: 'Legislation',
  cases: 'Cases',
  library: 'Library',
  directory: 'Directory',
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const res = await fetch('/corpus/manifest.json')
  if (!res.ok) throw new Error('manifest unavailable')
  const data = (await res.json()) as { datasets?: Array<{ file: string; rows: number }> }
  return (data.datasets || []).map((d) => {
    const parts = d.file.split('/')
    const code = parts[parts.length - 1].replace(/\.jsonl\.gz$/, '').replace(/\.jsonl$/, '')
    const groupKey = parts.length > 1 ? parts[0] : 'law'
    return {
      code,
      name: NAMES[code] || code,
      group: GROUPS[groupKey] || groupKey,
      rows: d.rows,
      file: d.file,
    }
  })
}

export function groupDatasets(datasets: DatasetInfo[]): Array<{ group: string; items: DatasetInfo[] }> {
  const order = ['Codes', 'Court rules', 'Forms', 'Legislation', 'Cases', 'Library', 'Directory']
  const byGroup = new Map<string, DatasetInfo[]>()
  for (const d of datasets) {
    const list = byGroup.get(d.group) || []
    list.push(d)
    byGroup.set(d.group, list)
  }
  return [...byGroup.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([group, items]) => ({ group, items }))
}

const ACRONYMS = new Set(['DUI', 'DMV', 'DNA', 'HIV', 'AIDS', 'ADA', 'IRS', 'FBI', 'DOJ', 'OSHA', 'EPA', 'FTB', 'EDD', 'CHP'])

/** Corpus source titles are stored in all caps. For display, a title that is
 *  mostly uppercase is sentence cased; anything already mixed case is left
 *  exactly as written. */
export function displayTitle(title: string): string {
  if (!title) return title
  const letters = title.replace(/[^A-Za-z]/g, '')
  if (letters.length < 8) return title
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.8) return title
  const lowered = title.toLowerCase().replace(/\b([a-z])/, (m) => m.toUpperCase())
  return lowered.replace(/\b([a-z]{2,})\b/g, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w))
}

export function displayNameFor(code: string): string {
  return NAMES[code] || code
}
