import MiniSearch, { type SearchResult as MiniResult } from 'minisearch'
import type { DocumentSearchResponse, SearchIndexRow } from '../../types'

export type SearchTag = 'PARTY' | 'AGREEMENT' | 'INVENTORY' | 'CHALLAN' | 'BILL'
export interface SearchResult {
  key: string
  tag: SearchTag
  title: string
  subtitle: string
  href: string
  viaSite?: string
  score: number
}

const NON_TOKEN = /[^\p{L}\p{M}\p{N}\s\-/_]+/gu
const SEPARATORS = /[-/_]+/g
const TRAILING_EPOCH = /_\d{10,}$/

/** Lowercase, split on whitespace and - / _, keep whole + separator-stripped variants. */
export function tokenize(text: string): string[] {
  const out = new Set<string>()
  for (const word of text.toLowerCase().replace(NON_TOKEN, ' ').split(/\s+/)) {
    if (!word) continue
    const parts = word.split(SEPARATORS).filter(Boolean)
    const candidates = [...parts]
    if (parts.length > 1 || word !== parts[0]) {
      candidates.push(word.replace(/^[-/_]+|[-/_]+$/g, ''), parts.join(''))
    }
    for (const t of candidates) if (t) out.add(t)
  }
  return [...out]
}

/** 'JOHN_SITE_1731654321000' -> 'JOHN · SITE' */
export function agreementLabel(agreementId: string): string {
  const parts = agreementId.split('_')
  if (parts.length >= 3) return `${parts[0]} · ${parts.slice(1, -1).join('_')}`
  return parts.join(' · ')
}

type Doc = SearchIndexRow & { key: string }

const FIELDS = ['name', 'code', 'gst', 'phone', 'siteCodes', 'siteAddresses', 'agreementId', 'partyName', 'partyCode', 'category', 'siteCode', 'siteAddress']
const SITE_FIELDS = new Set(['siteCodes', 'siteAddresses', 'siteCode', 'siteAddress'])

export function createEntityEngine(rows: SearchIndexRow[]): MiniSearch<Doc> {
  const engine = new MiniSearch<Doc>({
    idField: 'key',
    fields: FIELDS,
    storeFields: ['key', 't', 'id', 'name', 'code', 'gst', 'phone', 'sites', 'partyId', 'partyName', 'partyCode', 'siteCode', 'siteAddress', 'status', 'category'],
    tokenize,
    processTerm: (t) => t,
    extractField: (doc, field) => {
      if (field === 'siteCodes') return doc.t === 'party' ? doc.sites.map((s) => s.code).join(' ') : ''
      if (field === 'siteAddresses') return doc.t === 'party' ? doc.sites.map((s) => s.address).join(' ') : ''
      if (field === 'agreementId') return doc.t === 'agreement' ? doc.id.replace(TRAILING_EPOCH, '') : ''
      const v = (doc as unknown as Record<string, unknown>)[field]
      if (field === 'sites') return v ?? []
      return typeof v === 'string' ? v : ''
    },
    searchOptions: {
      tokenize,
      processTerm: (t) => t,
      boost: { code: 3, agreementId: 3, gst: 3, siteCodes: 2, name: 2, siteAddresses: 1, partyName: 0.5 },
      prefix: true,
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      boostDocument: (_id, _term, stored) => (stored?.t === 'agreement' && stored.status !== 'active' ? 0.6 : 1),
    },
  })
  const byKey = new Map<string, Doc>()
  for (const r of rows) byKey.set(`${r.t}:${r.id}`, { ...r, key: `${r.t}:${r.id}` } as Doc)
  engine.addAll([...byKey.values()])
  return engine
}

function describeSite(code: string, address: string) {
  return address ? `${code} · ${address}` : code
}

function toResult(hit: MiniResult): SearchResult {
  const d = hit as unknown as Doc & { match: Record<string, string[]> }
  const matchedTerms = new Set<string>()
  let viaSiteField = false
  for (const [term, fields] of Object.entries(hit.match)) {
    if (fields.some((f) => SITE_FIELDS.has(f))) { viaSiteField = true; matchedTerms.add(term) }
  }
  const base = { key: '', score: hit.score }
  if (d.t === 'party') {
    const sites = d.sites ?? []
    let matching: typeof sites = []
    if (viaSiteField) {
      const toks = (s: (typeof sites)[number]) => tokenize(`${s.code} ${s.address}`).filter((t) => matchedTerms.has(t))
      matching = sites.filter((s) => {
        const t = toks(s)
        return hit.queryTerms.every((q: string) => t.some((x) => x.startsWith(q)))
      })
      if (matching.length === 0) matching = sites.filter((s) => toks(s).length > 0)
    }
    const extra = [d.gst || d.phone || ''].filter(Boolean)
    return {
      ...base, key: `PARTY:${d.id}`, tag: 'PARTY', title: d.name,
      subtitle: [d.code, ...extra].join(' · '), href: `/parties/${d.id}`,
      viaSite: matching.length
        ? describeSite(matching[0].code, matching[0].address) + (matching.length > 1 ? ` +${matching.length - 1} more` : '')
        : undefined,
    }
  }
  if (d.t === 'agreement') {
    return {
      ...base, key: `AGREEMENT:${d.id}`, tag: 'AGREEMENT',
      title: `${agreementLabel(d.id)} (${d.status})`, subtitle: d.partyName, href: `/agreements/${d.id}`,
      viaSite: viaSiteField ? describeSite(d.siteCode, d.siteAddress ?? '') : undefined,
    }
  }
  return {
    ...base, key: `INVENTORY:${d.id}`, tag: 'INVENTORY', title: d.name,
    subtitle: [d.code, d.category].filter(Boolean).join(' · '), href: `/inventory/${d.id}`,
  }
}

export function searchEntities(engine: MiniSearch<Doc>, query: string, limit = 10): SearchResult[] {
  if (tokenize(query).length === 0) return []
  let hits = engine.search(query, { combineWith: 'AND' })
  if (hits.length === 0) hits = engine.search(query, { combineWith: 'OR' })
  return hits.slice(0, limit).map(toResult)
}

export function hasDocumentToken(query: string): boolean {
  return query.split(/\s+/).some((w) => (w.match(/\d/g) ?? []).length >= 2)
}

export function isDigitHeavy(query: string): boolean {
  const chars = query.replace(/\s+/g, '')
  if (!chars) return false
  return (chars.match(/\d/g) ?? []).length / chars.length >= 0.5
}

const fmtDate = (d?: string) => (d ? d.slice(0, 10) : '')

export function documentsToResults(r: DocumentSearchResponse): SearchResult[] {
  const total = r.challans.length + r.bills.length
  let i = 0
  const score = () => total - i++
  const challans = r.challans.map((c): SearchResult => ({
    key: `CHALLAN:${c.id}`, tag: 'CHALLAN', title: c.challanNumber,
    subtitle: [c.partyName, fmtDate(c.date), c.status].filter(Boolean).join(' · '), href: `/challans/${c.id}`, score: score(),
  }))
  const bills = r.bills.map((b): SearchResult => ({
    key: `BILL:${b.id}`, tag: 'BILL', title: b.billNumber,
    subtitle: [b.partyName, fmtDate(b.billDate), `₹${b.totalAmount.toLocaleString('en-IN')}`, b.status].filter(Boolean).join(' · '),
    href: `/bills/${b.id}`, score: score(),
  }))
  return [...challans, ...bills]
}

export function mergeResults(entities: SearchResult[], documents: SearchResult[], query: string, max = 10): SearchResult[] {
  const docs = entities.length > 0 ? documents.slice(0, 5) : documents.slice(0, max)
  const ents = entities.slice(0, Math.max(0, max - docs.length))
  return isDigitHeavy(query) ? [...docs, ...ents] : [...ents, ...docs]
}
