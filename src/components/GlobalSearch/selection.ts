import type { SearchResult } from './searchEngine'

/** Move the highlighted result up/down, wrapping at the ends. */
export function moveSelection(results: SearchResult[], currentKey: string | null, dir: 1 | -1): string | null {
  if (results.length === 0) return null
  const idx = currentKey === null ? -1 : results.findIndex((r) => r.key === currentKey)
  if (idx === -1) return results[dir === 1 ? 0 : results.length - 1].key
  return results[(idx + dir + results.length) % results.length].key
}

/** Keep the highlight pinned to the same result when results change under it. */
export function reconcileSelection(next: SearchResult[], currentKey: string | null, queryChanged: boolean): string | null {
  if (next.length === 0) return null
  if (!queryChanged && currentKey !== null && next.some((r) => r.key === currentKey)) return currentKey
  return next[0].key
}
