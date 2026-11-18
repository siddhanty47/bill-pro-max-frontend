/**
 * Runs before every test file (vitest `setupFiles`).
 * - jest-dom matchers (toBeInTheDocument, toHaveValue, ...)
 * - MSW: any request without a handler FAILS the test (no real network)
 * - Supabase client stubbed (no session, no network)
 * - DOM cleanup + localStorage reset between tests
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// findBy/waitFor budget: the default 1000 ms is too tight when CI or a second
// test run saturates the CPU.
configure({ asyncUtilTimeout: 5000 });

// jsdom gaps used by UI code.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
