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
];
