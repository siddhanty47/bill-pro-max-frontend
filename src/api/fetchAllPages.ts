/**
 * Load every page of a paginated list endpoint and return the rows as one array.
 *
 * List endpoints cap `pageSize` at 100; pages that need the whole list (browser-side
 * filtering, dropdowns, dashboard totals) use this instead of a single capped request.
 */
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { PaginatedResponse } from '../types';

/** Backend maximum page size. */
export const MAX_PAGE_SIZE = 100;
/** Safety stop: 100 pages × 100 rows. */
const MAX_PAGES = 100;

type BaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export async function fetchAllPages<T>(
  url: string,
  baseQuery: (arg: string | FetchArgs) => ReturnType<BaseQuery>
): Promise<{ data: T[] } | { error: FetchBaseQueryError }> {
  const rows: T[] = [];
  const join = url.includes('?') ? '&' : '?';
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await baseQuery(`${url}${join}page=${page}&pageSize=${MAX_PAGE_SIZE}`);
    if (result.error) return { error: result.error };
    const body = result.data as PaginatedResponse<T>;
    rows.push(...body.data);
    if (!body.pagination?.hasNext) break;
  }
  return { data: rows };
}
