/**
 * State + data logic for the header GlobalSearch (query, debounce, results,
 * selection). Kept separate so GlobalSearch.tsx stays presentational.
 */
import { useEffect, useMemo, useState } from 'react'
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness'
import { useGetSearchIndexQuery, useSearchDocumentsQuery } from '../../api/searchApi'
import {
  createEntityEngine,
  documentsToResults,
  hasDocumentToken,
  isDigitHeavy,
  mergeResults,
  searchEntities,
  type SearchResult,
} from './searchEngine'
import { moveSelection, reconcileSelection } from './selection'

const DEBOUNCE_MS = 250
const EMPTY: SearchResult[] = []

interface SelectionState {
  key: string | null
  /** Query the selection was last reconciled against. */
  query: string
  /** Result list the selection was last reconciled against. */
  results: SearchResult[]
}

export function useGlobalSearch() {
  const { currentBusinessId } = useCurrentBusiness()
  const businessId = currentBusinessId ?? ''

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<SelectionState>({ key: null, query: '', results: EMPTY })

  // Reset everything when the business changes (adjust-state-during-render pattern).
  const [prevBusinessId, setPrevBusinessId] = useState(businessId)
  if (prevBusinessId !== businessId) {
    setPrevBusinessId(businessId)
    setQuery('')
    setDebounced('')
    setOpen(false)
    setSel({ key: null, query: '', results: EMPTY })
  }

  // `currentData` is only ever data for the *current* arg, so a business switch
  // never shows the previous business's index while the new one loads.
  const { currentData: index, isFetching: isIndexFetching, isError: indexError } = useGetSearchIndexQuery(
    { businessId },
    { skip: !businessId },
  )
  const caps = index?.capabilities
  const canSearchDocs = !!caps && (caps.bills || caps.challans)
  const hidden = !businessId || (!index && indexError) || (!!caps && !caps.entities && !caps.bills && !caps.challans)
  const indexing = !index && isIndexFetching

  const engine = useMemo(
    () => (index ? createEntityEngine(index.rows) : null),
    // Rebuild only when the index version (or business) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, index?.version],
  )

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const trimmed = query.trim()
  const docsWanted = canSearchDocs && hasDocumentToken(trimmed)
  const docsArg = { businessId, q: debounced }
  const {
    currentData: docData,
    originalArgs: docArgs,
    isFetching: isDocsFetching,
  } = useSearchDocumentsQuery(docsArg, { skip: !canSearchDocs || !businessId || !hasDocumentToken(debounced) })

  const entityResults = useMemo(
    () => (engine && trimmed ? searchEntities(engine, trimmed) : EMPTY),
    [engine, trimmed],
  )

  // Only trust document hits fetched for exactly this business + debounced query.
  const docsMatch = docsWanted && debounced === trimmed && !!docData && docArgs?.businessId === businessId && docArgs?.q === debounced
  const docResults = useMemo(
    () => (docsMatch && docData ? documentsToResults(docData) : EMPTY),
    [docsMatch, docData],
  )
  const docsLoading = docsWanted && (debounced !== trimmed || isDocsFetching)

  const results = useMemo(
    () => (trimmed ? mergeResults(entityResults, docResults, trimmed) : EMPTY),
    [entityResults, docResults, trimmed],
  )

  // Reconcile selection whenever the result list identity changes.
  let selectedKey = sel.key
  if (sel.results !== results) {
    selectedKey = reconcileSelection(results, sel.key, sel.query !== trimmed)
    setSel({ key: selectedKey, query: trimmed, results })
  }

  const move = (dir: 1 | -1) => setSel((s) => ({ ...s, key: moveSelection(results, s.key, dir) }))
  const select = (key: string) => setSel((s) => ({ ...s, key }))
  const reset = () => {
    setQuery('')
    setDebounced('')
    setOpen(false)
  }

  return {
    hidden,
    indexing,
    query,
    setQuery,
    trimmed,
    open,
    setOpen,
    results,
    selectedKey,
    selected: results.find((r) => r.key === selectedKey) ?? null,
    move,
    select,
    reset,
    docsLoading,
    docsFirst: isDigitHeavy(trimmed),
  }
}
