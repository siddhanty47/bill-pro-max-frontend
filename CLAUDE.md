# BillProMax Frontend

React SPA for scaffolding rental business management. See README.md for setup. This file focuses on architecture patterns and change guidance.

## Architecture

- **React 19** with **Vite** build tool
- **Redux Toolkit** + **RTK Query** for state and API caching
- **React Router 7** for routing
- **React Hook Form** + **Zod** for form validation
- **Supabase JS** for authentication
- **Socket.IO** client for real-time updates

## Testing & PRs

- Test layers, helpers and rules: **`TESTING.md`** (vitest + jsdom + Testing Library; MSW for API; `renderWithProviders` in `src/test/render.tsx`; tests next to the code as `*.test.ts(x)`).
- Skills: **`write-tests`** and **`raise-pr`** in `.claude/skills/`.
- Gates (CI runs the same on every PR): `npm run lint`, `format:check`, `typecheck`, `test:coverage`, `coverage:changed` (changed files ≥ 80% lines), `build`.

## API Layer (RTK Query)

`src/api/baseApi.ts` defines the base API with:
- Auth header injection (gets fresh Supabase token before each request)
- Auto-logout on 401 responses
- Tag types for cache invalidation

**Tag types:** `Business`, `Party`, `Inventory`, `Challan`, `Bill`, `Payment`, `Agreement`, `Member`, `Invitation`, `Notification`, `Employee`, `Attendance`, `ShareLink`, `Preset`, `AuditLog`, `Assistant`, `SearchIndex`, `Dashboard`

Each entity has its own API file in `src/api/` that injects endpoints via `baseApi.injectEndpoints()`. Follow the pattern in `partyApi.ts` when creating new ones.

**URL pattern for business-scoped resources:** `/businesses/${businessId}/entities`

**Lists:** whole-list queries use `queryFn` + `fetchAllPages` (`src/api/fetchAllPages.ts`) so they load every backend page (the backend caps `pageSize` at 100). Challans and bills also have server-paged `getChallansPage`/`getBillsPage` (`{ rows, total }`, filters + `search` sent as params via `listParams`) used by their list pages. Tables that open a record pass `DataTable rowLink`, which carries Prev/Next state (`src/utils/recordNav.ts`) to the detail page (`DetailPageShell recordNoun` → `RecordPager`); server-paged tables also pass `pagination.navSource`.

**Critical:** When adding a new entity API, you MUST add its tag type to the `tagTypes` array in `baseApi.ts`. Missing tags cause stale data after mutations (cache won't invalidate).

## Auth Flow

1. On app load, `App.tsx` useEffect calls `supabase.auth.getSession()` to hydrate session
2. If session exists, dispatches `setCredentials` with token and syncs with backend via `POST /auth/sync`
3. `authSlice` (`src/store/authSlice.ts`) stores token + user in Redux and persists to `localStorage`
4. `baseApi.ts` prepareHeaders gets fresh Supabase token before every API call
5. On 401 response, `baseQueryWithReauth` dispatches `auth/logout`
6. `supabase.auth.onAuthStateChange` listens for sign-in, token refresh, and sign-out events

**Invitation flow:** `InvitationAcceptPage` stores invitation token in `localStorage` before OAuth redirect. After sign-in, `App.tsx` checks for stored token and redirects to `/invitations/:token`.

## Routing

Defined in `src/App.tsx`.

**Public routes** (no auth required):
- `/login`, `/register`, `/forgot-password`
- `/invitations/:token` — Team invitation acceptance
- `/share/:token` — Public party portal (read-only)

**Protected routes** (wrapped in `<ProtectedRoute>` + `<Layout>`):
- `/` — Dashboard
- `/business` — Business settings
- `/inventory`, `/inventory/:itemId`
- `/parties`, `/parties/:partyId`
- `/agreements`, `/agreements/:agreementId`
- `/challans`, `/challans/:challanId`
- `/bills`, `/bills/:billId`
- `/payments`, `/payments/:paymentId`
- `/team` — Team members & invitations

**Sidebar navigation** defined in `Layout.tsx` (`navGroups` array near the top: optional group label + items with `path`, `label`, `icon`).

## Component Patterns

### Forms
- Located in `src/components/forms/`
- Use React Hook Form with Zod resolver for validation
- Each form has a `.tsx` and optional `.module.css`
- Forms: `BusinessForm`, `PartyForm`, `InventoryForm`, `AgreementForm`, `ChallanForm`, `BillForm`, `BulkBillForm`, `PaymentForm`

### Shared Components
- `src/components/ui/` — the design-system kit (import from `components/ui`; list and props in `src/components/ui/README.md`): `Button`, `IconButton`, `Icon`, `Brand`, `GoogleIcon`, `Avatar`, `Dot`, `NotAdded`, `TextLink`, `Notice`, `Card`, `StatCard`, `Meter`, `ProgressBar`, `PageHeader`, `EmptyState`, `StatusChip` (+ `status.ts`), `DocNumber`, `DataTable`, `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`, `Pagination`, `SegmentedControl`, `Field`/`Input`/`Select`/`Textarea`/`Checkbox`/`Fieldset`, `SearchInput`, `FilterBar`, `Menu`/`MenuItem`/`MenuLabel`/`MenuDivider`, `RowActions`, `Modal`, `Tabs`/`TabPanel`, `Spinner`, `ErrorMessage`
- `Layout.tsx` — App shell with sidebar + header + business switcher
- `ProtectedRoute.tsx` — Auth guard, redirects to `/login` if unauthenticated
- `DetailPageShell.tsx` — `DetailPageShell`, `DetailSection`, `DetailField` (detail page layout, built on the kit)
- `RecordPager.tsx` — Prev/Next (and `[`/`]`) through the table a record was opened from (rendered by `DetailPageShell recordNoun`)
- `NotificationBell.tsx` — In-app notification dropdown
- `DocumentNumberBadge.tsx` — Styled document number display
- `EditableField.tsx` — Inline-editable field component
- `ShareLinkManager.tsx` — Share link CRUD (embedded in PartyDetailPage)
- `ChangeHistoryTable.tsx` — Shared Jira-style audit history table (used in all detail pages)
- Formatters: `formatMoney`, `formatDate`, `formatDateTime`, `formatMonth` in `src/utils/format.ts`

### Statement Previews
- Located in `src/components/statements/`
- `StatementPreview.tsx` (base), `LedgerPreview.tsx`, `BillsPreview.tsx`, `ItemsPreview.tsx`, `AgingPreview.tsx`

## Styling Rules

**Before building or restyling ANY component, invoke the `frontend-design` skill** (`.claude/skills/frontend-design/`). It documents the design system: the "calm workspace" look, the exact CSS tokens, the `src/components/ui/` kit with its props, and the page, form, copy and mobile rules.

**MANDATORY: Never use inline `style={}` attributes in JSX.**

- Use the `src/components/ui/` kit for every pattern it covers; never restyle it or override its classes from a page.
- Page styles: CSS modules (`.module.css`), layout only (grid/flex/gap/margins/widths using `--space-*`). `import styles from './Component.module.css'`; `className={styles.myClass}`.
- Design tokens live in `:root` of `src/globals.css`. **Never hardcode colors/fonts/radii/shadows**; always use `var(--…)` tokens.
- There are no legacy global classes (`.btn`, `.card`, `.data-table`, `.status-*`, `.form-group`, `.link-accent`, `.text-empty` are gone); everything comes from the kit.
- **Strict token check:** `npm run lint` runs ESLint and then `node scripts/check-design-tokens.mjs --strict`; any finding (literal colour, non-token font or shadow, literal border-radius, inline `style={`) fails lint. Only `GoogleIcon.tsx` is allowlisted, and `globals.css` (it defines the tokens) is excluded; the kit (`src/components/ui/**`) is scanned like all other source.
- If you encounter existing inline styles, refactor them into CSS module classes

## WebSocket Integration

- `WebSocketContext` in `src/context/WebSocketContext.tsx` — Provides Socket.IO connection
- `WebSocketProvider` wraps the `Layout` component
- `useWebSocket` hook in `src/hooks/useWebSocket.ts` — Subscribe to events
- `useBillGenerationProgress` in `src/hooks/useBillGenerationProgress.ts` — Track bulk bill generation progress via WebSocket

## Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAuth` | `src/hooks/useAuth.ts` | Auth state, login, logout, user info |
| `useCurrentBusiness` | `src/hooks/useCurrentBusiness.ts` | Active business selection and switching |
| `useWebSocket` | `src/hooks/useWebSocket.ts` | Socket.IO event subscription |
| `useBillGenerationProgress` | `src/hooks/useBillGenerationProgress.ts` | Real-time bill generation tracking |
| `useHotkey` | `src/hooks/useHotkey.ts` | Keyboard shortcut binding |
| `usePlatform` | `src/hooks/usePlatform.ts` | OS detection (macOS vs others) |

## Adding a New Entity

1. Add TypeScript types to `src/types/index.ts`
2. Create `src/api/newEntityApi.ts` — inject endpoints into `baseApi` (follow `partyApi.ts` pattern)
3. Add tag type string to `tagTypes` array in `src/api/baseApi.ts`
4. Create form: `src/components/forms/NewEntityForm.tsx` + `NewEntityForm.module.css`
5. Create list page: `src/pages/NewEntitiesPage.tsx` + `NewEntitiesPage.module.css`
6. Create detail page: `src/pages/NewEntityDetailPage.tsx` + `NewEntityDetailPage.module.css`
7. Add routes in `src/App.tsx`:
   - List: `<Route path="newentities" element={<NewEntitiesPage />} />`
   - Detail: `<Route path="newentities/:entityId" element={<NewEntityDetailPage />} />`
8. Add sidebar link in `src/components/Layout.tsx` — add an item (with an `Icon` name) to the right group in the `navGroups` array

## Regression Risks

- **Missing tag type in `baseApi.ts`**: RTK Query cache won't invalidate after mutations. Symptom: stale data, user has to refresh.
- **Type changes in `types/index.ts`**: TypeScript catches most issues, but optional-to-required field changes can cause runtime errors in components that don't handle `undefined`.
- **Route path changes in `App.tsx`**: Any `<Link to="...">`, `navigate()`, or `useParams()` referencing old paths will break. Search the codebase for the old path.
- **Removing RTK Query hooks**: Hooks are used across multiple pages. Search for the hook name before removing.
- **Supabase config changes**: Breaks auth entirely. Test login flow (email + Google OAuth) after any auth-related change.
- **`authSlice` action changes**: `App.tsx`, `baseApi.ts`, `useAuth.ts`, and `ProtectedRoute.tsx` all depend on auth state shape.
- **Layout.tsx changes**: Affects every protected page (sidebar, header, business switcher, notification bell).
