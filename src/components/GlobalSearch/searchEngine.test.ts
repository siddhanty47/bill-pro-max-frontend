import { describe, it, expect } from 'vitest'
import {
  agreementLabel, createEntityEngine, searchEntities, hasDocumentToken, isDigitHeavy, mergeResults, tokenize,
  documentsToResults, type SearchResult,
} from './searchEngine'
import type { SearchIndexRow } from '../../types'

const rows: SearchIndexRow[] = [
  { t: 'party', id: 'p1', name: 'Sharma Contractors', code: 'SHAR', gst: '27ABCDE1234F1Z5', sites: [{ code: 'SITE-02', address: '12 MG Road, Pune' }] },
  { t: 'agreement', id: 'SHAR_SITE-02_1731654321000', partyId: 'p1', partyName: 'Sharma Contractors', partyCode: 'SHAR', siteCode: 'SITE-02', siteAddress: '12 MG Road, Pune', status: 'active' },
  { t: 'agreement', id: 'SHAR_SITE-09_1600000000000', partyId: 'p1', partyName: 'Sharma Contractors', partyCode: 'SHAR', siteCode: 'SITE-09', status: 'expired' },
  { t: 'party', id: 'p2', name: 'शर्मा ट्रेडर्स', code: 'SHTR', sites: [] },
  { t: 'party', id: 'p3', name: 'Verma Infra', code: 'VERM', phone: '9876543210', sites: [{ code: 'SITE-02', address: 'Baner' }, { code: 'SITE-03', address: 'Wakad' }] },
  { t: 'item', id: 'i1', name: 'MS Pipe 3m', code: 'ITM-012', category: 'Pipes' },
]
const engine = createEntityEngine(rows)

describe('searchEntities', () => {
  it('tolerates typos', () => expect(searchEntities(engine, 'Shrma')[0].title).toBe('Sharma Contractors'))
  it('matches prefixes', () => {
    const r = searchEntities(engine, 'shar')
    expect(r.some((x) => x.key === 'PARTY:p1')).toBe(true)
  })
  it('finds party and agreement via site address', () => {
    const r = searchEntities(engine, 'MG Road')
    const p = r.find((x) => x.key === 'PARTY:p1')
    const a = r.find((x) => x.key === 'AGREEMENT:SHAR_SITE-02_1731654321000')
    expect(p?.viaSite).toContain('12 MG Road')
    expect(a?.viaSite).toContain('12 MG Road')
  })
  it('finds items by code variants', () => {
    expect(searchEntities(engine, 'itm012').map((x) => x.title)).toContain('MS Pipe 3m')
    expect(searchEntities(engine, '012').map((x) => x.title)).toContain('MS Pipe 3m')
  })
  it('supports Devanagari', () => {
    expect(searchEntities(engine, 'शर्मा').map((x) => x.key)).toContain('PARTY:p2')
  })
  it('ranks expired agreements below active', () => {
    const r = searchEntities(engine, 'Sharma Contractors').filter((x) => x.tag === 'AGREEMENT')
    expect(r[0].key).toBe('AGREEMENT:SHAR_SITE-02_1731654321000')
    expect(r[0].score).toBeGreaterThan(r[1].score)
  })
  it('does not index agreement timestamps', () => {
    expect(searchEntities(engine, '1731654321000').filter((x) => x.tag === 'AGREEMENT')).toEqual([])
    expect(searchEntities(engine, '17316543').filter((x) => x.tag === 'AGREEMENT')).toEqual([])
  })
  it('finds parties by 10-digit phone', () => {
    const r = searchEntities(engine, '9876543210')
    expect(r[0].key).toBe('PARTY:p3')
    expect(r[0].subtitle).toBe('VERM · 9876543210')
  })
  it('ranks party code match above agreement for prefix', () => {
    const r = searchEntities(engine, 'shar')
    expect(r[0].key).toBe('PARTY:p1')
  })
  it('does not throw on duplicate rows', () => {
    expect(() => createEntityEngine([rows[0], rows[0]])).not.toThrow()
  })
  it('separator-only query returns nothing', () => expect(searchEntities(engine, '--')).toEqual([]))
  it('viaSite lists only precisely matching sites', () => {
    const p = searchEntities(engine, 'SITE-02').find((x) => x.key === 'PARTY:p3')
    expect(p?.viaSite).toBe('SITE-02 · Baner')
  })
  it('party subtitle shows GST value', () => {
    expect(searchEntities(engine, 'Sharma')[0].subtitle).toBe('SHAR · 27ABCDE1234F1Z5')
  })
  it('blank query returns nothing', () => expect(searchEntities(engine, '   ')).toEqual([]))
  it('builds titles, hrefs', () => {
    const a = searchEntities(engine, 'SITE-02').find((x) => x.tag === 'AGREEMENT')!
    expect(a.title).toBe('SHAR · SITE-02 (active)')
    expect(a.href).toBe('/agreements/SHAR_SITE-02_1731654321000')
  })
})

describe('helpers', () => {
  it('agreementLabel', () => expect(agreementLabel('SHAR_SITE-02_1731654321000')).toBe('SHAR · SITE-02'))
  it('tokenize', () => {
    expect(tokenize('ITM-012')).toEqual(expect.arrayContaining(['itm', '012', 'itm-012', 'itm012']))
    expect(tokenize('x 1731654321000')).not.toContain('1731654321000')
  })
  it('hasDocumentToken', () => {
    expect(hasDocumentToken('a 4')).toBe(false)
    expect(hasDocumentToken('challan 42')).toBe(true)
  })
  it('isDigitHeavy', () => {
    expect(isDigitHeavy('42')).toBe(true)
    expect(isDigitHeavy('sharma 4')).toBe(false)
  })
  it('documentsToResults keeps order, challans first', () => {
    const r = documentsToResults({
      challans: [{ id: 'c1', challanNumber: 'D-2025-26-0042', partyId: 'p', partyName: 'X', date: '2025-05-01T00:00:00Z', type: 'delivery', status: 'active' } as never],
      bills: [{ id: 'b1', billNumber: 'B-1', partyId: 'p', partyName: 'X', billDate: '2025-05-02T00:00:00Z', status: 'sent', totalAmount: 1500 } as never],
    })
    expect(r.map((x) => x.key)).toEqual(['CHALLAN:c1', 'BILL:b1'])
    expect(r[0].score).toBeGreaterThan(r[1].score)
    expect(r[0].href).toBe('/challans/c1')
  })
})

const mk = (tag: SearchResult['tag'], i: number): SearchResult => ({ key: `${tag}:${i}`, tag, title: `${tag}${i}`, subtitle: '', href: '/', score: 100 - i })
describe('mergeResults', () => {
  const ents = Array.from({ length: 8 }, (_, i) => mk('PARTY', i))
  const docs = Array.from({ length: 7 }, (_, i) => mk('CHALLAN', i))
  it('entities first, docs capped at 5', () => {
    const r = mergeResults(ents, docs, 'shar')
    expect(r).toHaveLength(10)
    expect(r[0].tag).toBe('PARTY')
    expect(r.filter((x) => x.tag === 'CHALLAN').length).toBeLessThanOrEqual(5)
  })
  it('digit-heavy puts docs first', () => expect(mergeResults(ents, docs, '0042')[0].tag).toBe('CHALLAN'))
  it('docs fill remaining when few entities', () => expect(mergeResults(ents.slice(0, 2), docs, 'x')).toHaveLength(7))
  it('docs fill when no entities', () => expect(mergeResults([], docs, '42')).toHaveLength(7))
})
