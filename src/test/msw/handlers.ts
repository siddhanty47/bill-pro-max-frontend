/**
 * Default API handlers — safe "empty" responses for endpoints many components
 * hit on mount. Tests override with `server.use(http.get(apiUrl('/x'), ...))`.
 */
import { http, HttpResponse } from 'msw';

/** Absolute URL for an API path, matching VITE_API_URL in vitest.config.ts. */
export const apiUrl = (path: string): string => `http://api.test/api/v1${path}`;

/** Standard `{ success, data }` envelope used by the backend. */
export const ok = <T>(data: T) =>
  HttpResponse.json({ success: true, data, message: 'ok', timestamp: new Date().toISOString() });

export const handlers = [
  http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 0 })),
  http.get(apiUrl('/notifications'), () => ok([])),
  http.get(apiUrl('/businesses/:businessId/parties/:partyId/stock'), () => ok([])),
  http.get(apiUrl('/businesses/:businessId/dashboard/nav-counts'), () => ok({})),
  http.get(apiUrl('/businesses/:businessId/dashboard/summary'), () => ok({})),
  // No closed financial year on any site unless a test says otherwise
  http.get(apiUrl('/businesses/:businessId/year-close/site'), () => ok({ closedThrough: null })),
  http.get(apiUrl('/businesses/:businessId/dashboard/series'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    return ok({
      metric: query.get('metric') ?? 'billing',
      range: query.get('range') ?? '1Y',
      bucket: 'month',
      points: [],
    });
  }),
];

/**
 * Paginated `{ data, pagination }` envelope like the backend's list endpoints: reads
 * `page`/`pageSize` from the request and keeps only rows `match` accepts for the
 * request's query (status/type/search…). Rows are returned in the given order.
 */
export function pagedOk<T>(
  rows: T[],
  request: Request,
  match: (row: T, query: URLSearchParams) => boolean = () => true
) {
  const query = new URL(request.url).searchParams;
  const page = Number(query.get('page') ?? 1);
  const pageSize = Number(query.get('pageSize') ?? 20);
  const matching = rows.filter(row => match(row, query));
  const totalPages = Math.ceil(matching.length / pageSize);
  return HttpResponse.json({
    success: true,
    data: matching.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: matching.length,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    message: 'ok',
    timestamp: new Date().toISOString(),
  });
}
