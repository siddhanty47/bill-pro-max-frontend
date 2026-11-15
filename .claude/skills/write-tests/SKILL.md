---
name: write-tests
description: Use when adding or changing frontend code that needs tests, fixing a UI bug, adding a component/page/hook/API endpoint, or when coverage:changed fails. Picks the layer (unit / component / with-API) and uses the repo's test helpers (renderWithProviders, MSW, factories).
---

# Write tests (BillProMax frontend)

Read `TESTING.md` first — it is the source of truth for layers, helpers and rules. This skill is the procedure.

## 1. Decide what needs tests

```bash
git diff --name-only origin/main...HEAD -- src   # or the stacked base
```
List the user-visible behaviours each changed file affects. Bug fix → write the failing test **first**.

## 2. Pick the layer

| Changed code | Layer | How |
|---|---|---|
| `utils/`, pure helpers, search engine, selectors | Unit | plain vitest |
| Hook with no UI | Unit | `renderHook` (wrap in providers if it uses the store) |
| Component without API calls | Component | `render` + `userEvent.setup()` |
| Component/page using RTK Query (`use*Query` / `use*Mutation`) | With API | `renderWithProviders` + MSW handlers |
| `api/*Api.ts` endpoint change | With API | test a component that calls it, asserting the request MSW received |

## 3. Use the helpers

```tsx
import { http } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';

server.use(http.get(apiUrl('/businesses/biz-1/parties'), () => ok([makeParty()])));
const { user } = renderWithProviders(<PartiesPage />, { preloadedState: signedIn('biz-1'), route: '/parties' });
expect(await screen.findByText('Sharma')).toBeInTheDocument();
```
- Capture requests to assert on them: push `await request.json()` / `params` into an array inside the handler.
- Missing data shape → add a factory to `src/test/factories.ts` typed from `src/types`.
- Endpoint hit on mount by many components → add a default to `src/test/msw/handlers.ts`.
- An unhandled request **fails the test** — add the handler, don't loosen `onUnhandledRequest`.

## 4. Write them

- Queries: `getByRole(..., { name })` first; `findBy*` for async.
- `user-event` for typing/clicking/keyboard.
- Assert visible output, ARIA state, or the request payload — never internal state.
- No snapshots, no `setTimeout`, no real network, no inline `style` in test harnesses either.

## 5. Verify

```bash
npx vitest run <file>
npm run test:coverage && npm run coverage:changed   # changed files >= 80% lines
npm run lint && npm run typecheck
```
If total coverage rose noticeably, raise `coverage.thresholds.lines` in `vitest.config.ts` (rounded down). Never lower it.

## Red flags

| Thought | Do instead |
|---|---|
| "vi.mock the RTK Query hook" | Use MSW — mocking hooks skips the real cache/tag behaviour. |
| "getByTestId is easier" | Use role/label/placeholder; add an accessible name to the component if missing. |
| "Snapshot the component" | Assert the specific text/state that matters. |
| "Lower the threshold" | Add tests or split the change; tell the user if truly blocked. |
