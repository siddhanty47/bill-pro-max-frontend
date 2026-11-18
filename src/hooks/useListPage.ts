import { useState } from 'react';

/** Rows per page on server-paged lists (matches the table default). */
export const LIST_PAGE_SIZE = 25;

/**
 * Page number for a server-paged list. Goes back to page 1 whenever `filtersKey`
 * changes (search, status, type…) and steps back to the last page when the total
 * shrinks below the current one (e.g. after a delete). Adjusted during render.
 */
export function useListPage(
  filtersKey: string,
  total: number | undefined,
  pageSize = LIST_PAGE_SIZE
) {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(filtersKey);

  if (filtersKey !== lastKey) {
    setLastKey(filtersKey);
    setPage(1);
  }

  const lastPage = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  if (total !== undefined && page > lastPage) {
    setPage(lastPage);
  }

  return [page, setPage] as const;
}
