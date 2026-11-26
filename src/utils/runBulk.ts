/** One item's outcome from `runBulk`. */
export type BulkResult<T> = { item: T; ok: true } | { item: T; ok: false; error: unknown };

export type RunBulkOptions = {
  /** How many calls run at once (default 3, at least 1). */
  concurrency?: number;
};

/** Default number of calls `runBulk` keeps in flight. */
export const DEFAULT_BULK_CONCURRENCY = 3;

/**
 * Calls `fn` for every item with at most `concurrency` calls in flight. Results come back
 * in input order. Never rejects: a failure (rejected promise or a synchronous throw) is
 * captured as `{ ok: false, error }` and the other items still run.
 */
export async function runBulk<T>(
  items: readonly T[],
  fn: (item: T) => Promise<unknown>,
  opts: RunBulkOptions = {}
): Promise<Array<BulkResult<T>>> {
  const limit = Math.max(1, Math.floor(opts.concurrency ?? DEFAULT_BULK_CONCURRENCY));
  const results: Array<BulkResult<T>> = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      try {
        await fn(item);
        results[index] = { item, ok: true };
      } catch (error) {
        results[index] = { item, ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
