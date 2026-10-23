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
  CORP: 'Corporations Code',
  EDC: 'Education Code',
  ELEC: 'Elections Code',
  EVID: 'Evidence Code',
  FAC: 'Food and Agricultural Code',
  FAM: 'Family Code',
  GOV: 'Government Code',
  HNC: 'Harbors and Navigation Code',
  HSC: 'Health and Safety Code',
  INS: 'Insurance Code',
  LAB: 'Labor Code',
  MVC: 'Military and Veterans Code',
  PCC: 'Public Contract Code',
  PEN: 'Penal Code',
  PRC: 'Public Resources Code',
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
