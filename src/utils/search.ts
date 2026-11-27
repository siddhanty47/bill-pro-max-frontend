/**
 * Table search in the browser: true when the trimmed term is empty, or any value contains it
 * (case-insensitive). Missing values are skipped.
 */
export function matchesSearch(term: string, values: Array<string | null | undefined>): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return values.some(v => v != null && v.toLowerCase().includes(q));
}
