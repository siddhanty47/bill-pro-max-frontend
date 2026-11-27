# Global search

The header search finds parties, agreements and items instantly in the browser (MiniSearch over an
index downloaded once per business) and bills/challans by number from the server.

## Rules

- Shortcut `Ctrl+K` / `⌘+K` (`useHotkey('ctrl+k' | 'meta+k')`); `/` stays page-local. On ≤ 768 px a
  search icon opens the same bar.
- Entity index: `searchApi.getSearchIndex` → `GET /search/index`, provides `SearchIndex`. The
  backend answers 304 when the ETag matches.
- Engine (`components/GlobalSearch/searchEngine.ts`, `createEntityEngine`): MiniSearch over name,
  code, gst, phone, site codes/addresses, agreement id, party name…; `prefix: true`, fuzzy 0.2 for
  terms ≥ 4 chars; `code` boosted ×3.
- Document search: `searchApi.searchDocuments` → `GET /search/documents?q=`, only when the
  debounced query (`DEBOUNCE_MS = 250`) has a word with ≥ 2 digits (`hasDocumentToken`) and the
  index `capabilities` allow it; `keepUnusedDataFor: 30`. Hits are only trusted for the exact
  business + debounced query they were fetched for.
- Bill hits' `totalAmount` is the effective amount.
- Live refresh: `useSearchIndexSync` listens for `search:index-changed` `{ businessId }` and
  invalidates `SearchIndex` and `Dashboard` for the current business.
- List pages: challans and bills also take a `search` param on their server-paged lists
  (`getChallansPage`, `getBillsPage`, matched on number or party name).

## Key files

| Path | Role |
|------|------|
| `src/components/GlobalSearch/GlobalSearch.tsx` | Presentational bar + results |
| `src/components/GlobalSearch/useGlobalSearch.ts` | Query, debounce, results, selection |
| `src/components/GlobalSearch/searchEngine.ts` | MiniSearch setup and ranking |
| `src/components/GlobalSearch/SearchResultRow.tsx`, `highlight.ts`, `selection.ts` | Rows, highlighting, keyboard selection |
| `src/api/searchApi.ts` | Endpoints |
| `src/hooks/useSearchIndexSync.ts` | Socket invalidation |

## List search (table search boxes)

Separate from the header search: each list page has its own search box (`/` focuses it).

| List | Matches |
|------|---------|
| Bills, Challans (server, `search` param) | document number, party name or code, site code; challans also vehicle number and transporter |
| Parties | name, code, contact person, phone, email, GSTIN, site codes and addresses |
| Agreements | party, agreement id, site code, site address |
| Inventory | name, code, category, description |
| Payments | party name or code, reference |
| Credit/debit notes | note number, bill number, party name or code |

Browser-side lists use `matchesSearch(term, values)` (`src/utils/search.ts`: trimmed,
case-insensitive, skips missing values). The placeholder says what each box matches; keep it in
step when adding a field.

## Changing it safely

- Mutation on parties/sites/agreements/inventory: add `'SearchIndex'` to `invalidatesTags` (the
  backend also emits the socket event).
- New searchable field: backend `indexBuilder.ts`, `SearchIndexRow` type, and `FIELDS` here.
- Tests: `GlobalSearch/*.test.ts(x)`, `hooks/useSearchIndexSync.test.tsx`.

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/global-search.md`
- Spec: monorepo root `docs/superpowers/specs/2026-11-15-global-search-design.md`
