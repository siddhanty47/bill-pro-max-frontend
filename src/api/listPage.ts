/**
 * Helpers for server-paged list queries (challans, bills): build the query string
 * from the page + filters, and turn the backend envelope into a `PagedList`.
 */
import type { PagedList, PaginatedResponse } from '../types';

/** Query params with empty filters dropped, so the backend never sees `status=`. */
export function listParams(
  args: Record<string, string | number | undefined>
): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === '') continue;
    params[key] = value;
  }
  return params;
}

export function toPagedList<T>(response: PaginatedResponse<T>): PagedList<T> {
  const rows = response.data ?? [];
  const pagination = response.pagination;
  return {
    rows,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? rows.length,
    total: pagination?.total ?? rows.length,
  };
}
