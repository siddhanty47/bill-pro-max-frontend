/**
 * @fileoverview Small helpers shared by the bulk-action hooks: `plural`, splitting `runBulk`
 * results into done keys and skips, and the PDF download runner.
 */
import { runBulk, type BulkResult } from '../../utils/runBulk';

/** `one` for 1, `many` otherwise. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** A row a bulk run did not act on, and why. */
export type RowSkip<T> = { row: T; reason: string };

/** PDFs are heavy: at most this many download at once. */
export const PDF_CONCURRENCY = 2;

/** The keys that succeeded and a skip (with `reasonFor` the error) for each failure. */
export function splitResults<T>(
  results: Array<BulkResult<T>>,
  rowKey: (row: T) => string,
  reasonFor: (error: unknown) => string
): { done: string[]; skipped: Array<RowSkip<T>> } {
  const done: string[] = [];
  const skipped: Array<RowSkip<T>> = [];
  for (const r of results) {
    if (r.ok) done.push(rowKey(r.item));
    else skipped.push({ row: r.item, reason: reasonFor(r.error) });
  }
  return { done, skipped };
}

/** Downloads one PDF per row, `PDF_CONCURRENCY` at a time; never rejects. */
export async function downloadPdfs<T>(
  rows: readonly T[],
  download: (row: T) => Promise<unknown>,
  rowKey: (row: T) => string,
  reasonFor: (error: unknown) => string
) {
  const results = await runBulk(rows, download, { concurrency: PDF_CONCURRENCY });
  return splitResults(results, rowKey, reasonFor);
}
