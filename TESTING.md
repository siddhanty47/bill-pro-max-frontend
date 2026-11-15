# Testing — BillProMax Frontend

Vitest + jsdom + React Testing Library + MSW. Tests never load the developer's `.env`, never hit the real API, Supabase or WebSocket server.

| Layer | What | Tools | Example |
|---|---|---|---|
| **Unit** | pure functions, hooks without UI | vitest, `renderHook` | `components/GlobalSearch/searchEngine.test.ts` |
| **Component** | what the user sees and does in one component | RTL + `user-event` | `components/CodeAutocomplete.test.tsx`, `components/EditableField.test.tsx`, `pages/RegisterPage.test.tsx` |
| **With API** | components/pages using RTK Query hooks | MSW + `renderWithProviders` | `components/NotificationBell.test.tsx` |

Tests live **next to the code**: `Foo.tsx` → `Foo.test.tsx`, `util.ts` → `util.test.ts`.

## Commands

```bash
npm test                    # run once
npm run test:watch          # watch mode
npx vitest run path/to/file # one file
npm run test:coverage       # + coverage (coverage/)
npm run coverage:changed    # changed files vs origin/main must be >= 80% lines
```
`coverage:changed` options: `--base <ref>` (stacked branch → its parent), `--threshold <n>`.

## Coverage rules

- **Changed files ≥ 80% line coverage** (`scripts/check-changed-coverage.mjs`). Eligible files = what `coverage.include/exclude` in `vitest.config.ts` reports (excludes tests, `src/test/`, `main.tsx`, types).
- **Repo-wide floor** — `coverage.thresholds.lines` in `vitest.config.ts`. Ratchet: raise it as coverage grows (rounded down), never lower it.

## Infrastructure (`src/test/`)

| File | What it does |
|---|---|
| `setup.ts` | jest-dom matchers; MSW server with **`onUnhandledRequest: 'error'`** (an unmocked request fails the test); Supabase client stubbed; DOM + `localStorage` reset after each test; `scrollIntoView` polyfill. |
| `render.tsx` | `renderWithProviders(ui, { preloadedState, route })` → fresh store (real reducers + RTK Query via `setupStore`) + `MemoryRouter`; returns `{ user, store, ...rtl }`. `signedIn(businessId)` builds auth state. |
| `msw/handlers.ts` | `apiUrl(path)`, `ok(data)` envelope helper, default handlers for endpoints hit on mount. |
| `msw/server.ts` | The MSW server. Per-test overrides: `server.use(http.get(apiUrl('/x'), () => ok(...)))`. |
| `factories.ts` | `makeNotification(...)` etc. — objects typed from `src/types`. Add new factories here. |
| `env/` | Empty on purpose: Vite reads env from here in tests. Fake values are set in `vitest.config.ts` (`test.env`). |

## Writing tests — rules

1. **Query like a user**: `getByRole` (with `name`) → `getByLabelText` → `getByPlaceholderText` → `getByText`. `getByTestId` only as a last resort.
2. **Interact with `user-event`** (`const { user } = renderWithProviders(...)` or `userEvent.setup()`), not `fireEvent`.
3. **Assert what the user sees** or what the API received (capture the request in the MSW handler), not component internals or hook calls.
4. **Async UI** → `findBy*` / `waitFor`; never fixed timeouts.
5. **Mock at the network boundary** with MSW. `vi.mock` only for modules that talk to third parties directly (e.g. `api/authApi` → Supabase).
6. One behaviour per `it`, named as a sentence. No snapshots.
7. **Bug fix** → first a failing test that reproduces it.
8. Controlled components → test through a tiny stateful harness (see `CodeAutocomplete.test.tsx`).

## CI

`.github/workflows/ci.yml` runs on every PR: lint → format:check → typecheck → test:coverage → coverage:changed (vs the PR base) → build.
