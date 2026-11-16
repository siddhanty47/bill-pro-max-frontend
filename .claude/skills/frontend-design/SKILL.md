---
name: frontend-design
description: BillProMax frontend design system. Use before building, restyling or migrating any component, page or stylesheet in bill-pro-max-frontend. Covers tokens, the src/components/ui kit, page recipes, copy rules and mobile rules.
---

# Frontend Design System (BillProMax frontend)

Apply whenever you add or edit a component, page or stylesheet in `bill-pro-max-frontend`. The app has one visual language, and every pattern in it has exactly one implementation in `src/components/ui/`. Pages compose those components; they never restyle them.

## The look in one breath

The landing page (billpromax.com), "calm workspace" variant: near-black surfaces, hairline translucent borders, a single green accent, Archivo for titles, Inter for everything you read, JetBrains Mono only for numbers. Soft shapes (6px controls, 12px cards and tables, 16px modals, round chips), flat surfaces with a shadow only on things that float (menus, popovers, modals), restrained motion (a small hover lift, a one-time rise on mount). Dense data screens stay dense. It is not a terminal and must not look like one.

## Non-negotiables

1. **Tokens only.** Every colour, font, radius, shadow, space and z-index is a `var(--…)` from `src/globals.css` `:root`. A literal hex, `rgb()`, `white`, raw font name or raw `box-shadow` is a bug. Missing a token for a real new need → add it to `:root`, don't hardcode.
2. **Use the `ui/` kit; never restyle it.** If a pattern exists in `components/ui` (button, card, table, field, chip, menu, modal, …), use it. Don't wrap it to change its look and don't override its classes from a page. Need a different look → change the kit file (see "Changing the design").
3. **Page CSS modules are layout only:** grid, flex, gap, margins, widths, placement, using `--space-*` tokens. No colour, font, border, radius or shadow on anything the kit owns. A `className` passed to a kit component is for placement only.
4. **No inline `style={}`.** CSS modules or global classes. (Data-driven widths use SVG attributes, as `Meter` does.)
5. **Monospace only for numbers:** amounts, quantities, counts, dates in tables, document numbers. Always with `tabular-nums` (the `mono` props and the global `.mono` class do this). Never monospace for labels, body or headings.
6. **Sentence case everywhere.** Labels, buttons, headings, table headers, menu items. No UPPERCASE label rows, no Title Case Buttons.
7. **Icons only via `Icon`** (or `IconButton` / `Button icon=…`). No inline SVGs in pages, no emoji, no icon library. New glyph → add it to `ui/Icon.tsx` (18-unit viewBox, stroke 1.5, round caps/joins, `currentColor`).
8. **No filler copy.** A screen shows only what is necessary, useful and important. No taglines, descriptive subtitles, "Welcome back!" lines, helper prose that repeats the label, or explanations of the obvious.
9. **No AI tropes:** ✦ sparkles, gradient-shimmer text, glow blobs, pill "New" badges, emoji, decorative icon-card grids.
10. **No terminal leftovers:** `[BRACKETS]`, UPPERCASE small caps, `_` cursors, `>` prompts, ghost-everything buttons, monospace body text, 2px corners.

## Token cheat-sheet (`src/globals.css` `:root`)

**Surfaces:** `--bg-deepest #000` (header, sidebar) · `--bg-surface #0a0a0a` (page) · `--bg-elevated #111` (inputs, popovers) · `--bg-card #141414` · `--bg-hover #1a1a1a` · `--bg-input` (= elevated) · `--bg-header` (frosted header, 72% black) · `--bg-table-head` · `--bg-overlay` (modal backdrop).

**Borders (white alpha):** `--border-subtle .07` (cards, table rows) · `--border-default .12` (controls, hover) · `--border-medium .22` (emphasis).

**Text:** `--text-primary #d4d4d4` (body) · `--text-heading #fff` · `--text-secondary #8a8a8a` (labels, meta) · `--text-muted #5c5c5c` (placeholder, disabled) · `--text-on-accent #00130c` (text on accent fill) · `--text-inverse`.

**Accent:** `--accent #00cc88` · `--accent-hover #00e699` · `--accent-muted` (12% fill: active/selected backgrounds, focus ring) · `--accent-line` (35%: accent borders/rules). Accent = primary action, active nav, focus, links, the one highlighted stat. Nothing else.

**Status:** `--status-{success,warning,danger,info,neutral}-{bg,text,border}`; delivery/return: `--delivery-{accent,bg,border}`, `--return-{accent,bg,border}`. There is no `--danger` token. Status meaning only via these, and normally only through `StatusChip`.

**Fonts:** `--font-display` (Archivo, titles) · `--font-sans` (Inter, everything else) · `--font-mono` (JetBrains Mono, numbers). `--font-body` / `--font-heading` are migration aliases, removed in the last stage — don't use them in new code.

**Type scale:** `--text-xs 12` · `--text-sm 13` (labels) · `--text-base 14` (body) · `--text-md 16` (card titles) · `--text-lg 20` · `--text-xl 28` · `--text-2xl 36` (page title).

**Space:** `--space-1 4` · `-2 8` · `-3 12` · `-4 16` · `-5 20` · `-6 24` · `-8 32` · `-10 40` · `-14 56`.

**Radius:** `--radius-sm 4` (kbd hints, tiny inline chips) · `--radius-md 6` (buttons, icon buttons, inputs/selects/textareas, menu items) · `--radius-lg 12` (cards, tables) · `--radius-xl 16` (modals, auth panel) · `--radius-full` (chips, avatars, pills).

**Elevation:** `--shadow-sm/md/lg` are `none` (surfaces are flat) · `--shadow-pop` (menus, popovers, modals only) · `--shadow-accent` (primary button hover) · `--ring-focus` (3px accent-muted ring on inputs).

**Motion:** `--ease-out` · `--transition-fast .15s` · `--transition-default .2s` · `--duration-enter .45s`. Entrance animations use fill-mode `backwards` (so hover transforms still work). Everything is disabled under `prefers-reduced-motion` (global rule). No scroll-driven animation.

**Layout:** `--header-height 56` · `--sidebar-width 232` · `--content-max 1200` · `--page-pad 40` (16 at ≤768).

**Z-index:** `--z-sticky 10` · `--z-sidebar-overlay 99` · `--z-sidebar 100` · `--z-popover 150` · `--z-panel 200` · `--z-modal 300`. Use the token, never a raw number.

## Component catalogue (`src/components/ui`)

Import from the barrel: `import { Button, Card, DataTable } from '../components/ui';`. Non-component helpers come from their module: `import { statusTone, statusLabel } from '../components/ui/status';`. These accept and spread their native element's props (`id`, `aria-*`, `data-*`, handlers; `className` is merged): `Button`, `IconButton`, the `Field` family (`Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `Fieldset`), the `Table` primitives (`Tr`, `Th`, `Td`), `FilterBar`, and the `Menu` parts (`Menu`, `MenuItem`, `MenuLabel`, `MenuDivider`). The others take only the props listed below. The one-line "when to use" table is `src/components/ui/README.md`.

### Actions

- **`Button`** — every text button and button-styled link. `variant`: `'primary' | 'secondary' | 'ghost' | 'danger'` (default `secondary`) · `size`: `'sm' | 'md'` · `icon?: IconName` (leading) · `loading?` (disables, shows a spinner, keeps width and accessible name, sets `aria-busy`) · `to?` (renders a router `Link`) · `href?` (renders `<a>`) · native button props. Default `type="button"`; pass `type="submit"` in forms. `disabled`/`loading` links are inert (`aria-disabled`, `tabIndex -1`, click prevented). One primary per view.
  ```tsx
  <Button variant="primary" type="submit" loading={isSaving}>Save bill</Button>
  <Button icon="plus" to="/challans/new">New challan</Button>
  ```
- **`IconButton`** — icon-only buttons. `label` (required → `aria-label`) · `icon: IconName` · `badge?: boolean` (accent dot) · native button props. 44px at ≤768.
- **`Icon`** — `name: IconName` · `size?` (default 16) · `className?`. Always `aria-hidden`; put the accessible name on the control. Names: `dashboard inventory parties agreements challans bills payments team search bell chat chevron-down plus close menu arrow-right rupee settings logout brand`.
- **`GoogleIcon`** — Google's multi-colour logo for sign-in buttons only. `size?` (default 18) · `className?`. The only file allowed literal colours (token-check allowlist).

### Surfaces and page structure

- **`PageHeader`** — top of every page. `title` · `eyebrow?` (small mono accent line above the title: real context only, e.g. today's date on the dashboard or the entity type on a detail page, never a slogan) · `actions?: ReactNode`. No subtitle prop, by design.
- **`Card`** — any panel or section. `title?` · `count?: number` (pill after the title) · `countTone?: 'neutral' | 'danger'` · `actions?: ReactNode` (right of the title, e.g. an "All bills" link) · `padded?` (default `true`; pass `padded={false}` when the body is a table) · `to?` (whole card becomes a link with hover lift; then don't put links or buttons inside it) · `className?`.
- **`StatCard`** — one headline number. `label` · `value: ReactNode` (rendered mono) · `icon?` · `tone?: 'default' | 'highlight'` (accent tint; at most one per screen) · `to?` · `children?` (e.g. a `Meter`).
- **`Meter`** — segmented bar + legend. `segments: { value: number; tone: 'accent' | 'info' | 'warning' | 'danger'; label: string }[]`. Values formatted `en-IN`; bar has an `aria-label` summary.
- **`EmptyState`** — `title` (one short line saying what's missing) · `action?: ReactNode` (at most one, usually a `Button`). No prose paragraph.
- **`Tabs`** — `tabs: { id; label }[]` · `activeTab` · `onChange(id)`. Underline-accent style.
- **`Modal`** — `isOpen` · `onClose` · `title` · `children` · `size?: 'default' | 'form'` (wider, for forms) · `variant?: 'delivery' | 'return'` (challan flows only; coloured top edge). Autofocuses the first field; Escape and overlay click close (an Escape a nested widget already handled with `preventDefault`, e.g. an open `Menu`, is ignored); full-screen with safe-area padding at ≤768. Never build an ad-hoc overlay.
- **`Spinner`** (alias `LoadingSpinner`) — `message?` (default "Loading…"). Accent ring + message in a `role="status"` region; static under reduced motion. Page/panel loading.
- **`ErrorMessage`** — `error: unknown` (run through `getErrorMessage`) · `onRetry?`. Load/API errors.

### Data

- **`DataTable<T>`** — list data from an array. `columns: Column<T>[]` where `Column = { key; header; render?(row); align?: 'left' | 'right'; mono?; hideOnMobile? }` · `rows: T[]` · `rowKey(row): string` · `onRowClick?(row)` (rows become focusable, Enter activates) · `empty?: ReactNode` (defaults to `EmptyState title="Nothing here yet"`; pass a specific one). Without `render`, the cell shows `row[key]`. Owns the horizontal-scroll wrapper.
- **`Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`** — hand-built tables and editable grids (challan/bill item rows). `Th`/`Td`: `align?: 'left' | 'right' | 'center'` · `mono?` · `hideOnMobile?` · native cell props. `Tr`: `onClick?: (e: MouseEvent | KeyboardEvent) => void` makes the row clickable (focusable; fires on click and on Enter). `Table`: `className?`.
- Table rules: amounts and quantities `mono` + `align="right"`; dates and doc numbers `mono`; secondary columns (`Due`, `Site`, `Created by`) `hideOnMobile`. Buttons, links, inputs, selects and labels inside a clickable row handle their own click and **do not** trigger the row click — put row actions (a `Menu`, a `Button`) straight in a cell. Tables have no frame of their own: put them in `Card padded={false}`.
- **`StatusChip`** — every status badge, always `<StatusChip status={bill.status} />`. Tone comes from the single map in `ui/status.ts` (`paid/active/confirmed/completed/accepted/present` → success · `sent/delivery` → info · `partial/pending/return/half-day/leave` → warning · `overdue/failed/cancelled/terminated/declined/absent/revoked/suspended` → danger · anything else, e.g. `draft/expired/inactive`, → neutral; case-insensitive, never throws). Legacy `.status-*` classes in `globals.css` use the same tones (`.status-draft` is neutral). Label is the status in sentence case (`partially_paid` → "Partially paid"); `children` overrides it (e.g. `"12 days"`). To change a status colour, edit the map in `ui/status.ts` — never pass `tone` at a call site for a lifecycle status. `tone?: 'success' | 'info' | 'warning' | 'danger' | 'neutral'` is only for chips that are not lifecycle statuses.
- **`DocNumber`** — bill/challan/agreement numbers. `value` · `to?` (link to the document). Mono.

### Forms

- **`Field`** — label + control + hint + error. `label` · `hint?` · `error?` · `required?` · `htmlFor?` · div props. 
  - Auto-wiring: when its **single child** is `Input`, `Select`, `Textarea`, `Checkbox` or a native `input/select/textarea`, Field gives it an id (keeps an existing one), links the label, and sets `aria-describedby` (hint + error). For wrapper children (an input + button row, a custom autocomplete) pass `htmlFor` and put that id on the inner input yourself.
  - Pass the message as `error` on Field once; it renders a `role="alert"` line and sets `aria-invalid` on an auto-wired child. Don't also pass `invalid` or render your own error text.
  - Use the `required` prop (adds an `aria-hidden` marker and sets `required` + `aria-required="true"` on the auto-wired control). Never write a literal `*` in label text.
- **`Input`, `Select`, `Textarea`** — `forwardRef` (work with `register()`), native props plus `mono?` (numeric/amount/code inputs) and `invalid?` (only when not inside a `Field` with `error`). 44px / 16px font at ≤768.
- **`Checkbox`** — `label?` + native input props (forwardRef). Use it bare: `<Checkbox label="Include GST" {...register('gst')} />`, not inside `Field`. Several related checkboxes → group them in a `Fieldset`.
- **`Fieldset`** — `legend` + native fieldset props. Titled group of fields or checkboxes; looks the same as legacy `.form-fieldset` (card background, 12px radius, muted legend).
- **`FilterBar`** — wrapping row above a list for search and filter controls (children stack full width at ≤480). Div props.

### Menus

- **`Menu`** — `trigger: (props) => ReactNode` (spread `props` onto a `Button` or `IconButton`; it carries `onClick`, `aria-expanded`, `aria-haspopup`, `aria-controls` and the ref) · `align?: 'start' | 'end'` (default `end`) · `className?` (on the root wrapper around trigger + panel — placement only) · `menuClassName?` (on the `role="menu"` panel) · other native div props (go to the panel, e.g. `aria-label`) · `children`. Closes on outside click, Escape and Tab; returns focus to the trigger; arrow keys, Home and End move between items (ArrowUp with nothing focused → last item). Escape is `preventDefault`ed, so a Menu inside a `Modal` closes only the Menu. At ≤480 the panel spans the viewport width (16px gutters) under the trigger.
- **`MenuItem`** — `onSelect?` (or `to?` for a router link) · native button props. Closes the menu after select. **`MenuLabel`** (small heading inside a menu), **`MenuDivider`**.
  ```tsx
  <Menu trigger={p => <IconButton label="More actions" icon="menu" {...p} />}>
    <MenuItem to={`/bills/${bill._id}`}>Open</MenuItem>
    <MenuDivider />
    <MenuItem onSelect={() => setDeleting(bill)}>Delete</MenuItem>
  </Menu>
  ```
- Never build a dropdown with your own state and absolute positioning.

## Recipes

**List page** = `PageHeader` + `FilterBar` + `Card padded={false}` holding a `DataTable`.
```tsx
<PageHeader title="Bills" actions={<Button variant="primary" icon="plus" onClick={openCreate}>New bill</Button>} />
<FilterBar>
  <Input type="search" placeholder="Search bills" aria-label="Search bills" value={q} onChange={e => setQ(e.target.value)} />
  <Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>…</Select>
</FilterBar>
<Card padded={false}>
  <DataTable
    columns={[
      { key: 'billNumber', header: 'Bill', render: b => <DocNumber value={b.billNumber} />, },
      { key: 'party', header: 'Party', render: b => b.partyName },
      { key: 'dueDate', header: 'Due', mono: true, hideOnMobile: true, render: b => formatDate(b.dueDate) },
      { key: 'total', header: 'Amount', mono: true, align: 'right', render: b => formatAmount(b.total) },
      { key: 'status', header: 'Status', render: b => <StatusChip status={b.status} /> },
    ]}
    rows={bills}
    rowKey={b => b._id}
    onRowClick={b => navigate(`/bills/${b._id}`)}
    empty={<EmptyState title="No bills yet" action={<Button onClick={openCreate}>New bill</Button>} />}
  />
</Card>
```
Loading → `Spinner`; error → `ErrorMessage onRetry={refetch}`.

**Dashboard / detail page** = `PageHeader` (eyebrow for real context) + a layout grid (page CSS) of `StatCard`s and `Card`s. Sections are `Card title=… count=… actions=…`; lists inside are `DataTable` in `Card padded={false}`.

**Form** = `Field` + control + `Button`, inside a `Modal size="form"` or a `Card`.
```tsx
<form onSubmit={handleSubmit(onSubmit)}>
  <Field label="Party name" required error={errors.name?.message}>
    <Input {...register('name')} />
  </Field>
  <Field label="Rate per day" hint="Per piece" error={errors.rate?.message}>
    <Input mono inputMode="decimal" {...register('rate')} />
  </Field>
  <Field label="Item code" htmlFor="code">
    <div className={styles.codeRow}><Input id="code" {...register('code')} /><Button>Lookup</Button></div>
  </Field>
  <Checkbox label="Include GST" {...register('gst')} />
  <div className={styles.actions}>
    <Button onClick={onCancel}>Cancel</Button>
    <Button variant="primary" type="submit" loading={isSubmitting}>Save</Button>
  </div>
</form>
```
`styles.codeRow` / `styles.actions` are layout only (`display: flex; gap: var(--space-2)`).

**Status** = `<StatusChip status={x} />`. Overdue-by-days: `<StatusChip status="overdue">{days} days</StatusChip>`.

**Amounts** = mono, right-aligned, Indian grouping (`toLocaleString('en-IN')`), ₹ prefix. In a sentence: `<span className="mono">₹{amount.toLocaleString('en-IN')}</span>`.

## Copy rules

- Sentence case; short; verbs on buttons ("Save bill", "New challan", "Try again").
- Every line must earn its place: no subtitles under page titles, no hint that repeats the label, no "Manage your …" prose. Empty states: one line + one action.
- No ✦, emoji, exclamation marks, "AI-powered", "magic", "seamless".
- No terminal idioms: no `[STATUS]`, `>`, `_`, `//`, `$`, UPPERCASE labels, "Loading..." with ellipsis theatre.
- Never remove data, columns, fields or actions while trimming copy without asking.

## Mobile is part of every change (not a follow-up)

Staff use the app on site on phones, so a desktop-only change is incomplete. Check every change at 1280, 768 and 375.

**Breakpoints** (don't invent others): `max-width: 768px` = mobile (sidebar becomes a drawer, forms stack, modals go full-screen, `--page-pad` 16px); `max-width: 480px` = narrow phone (single-column grids, icon-only chrome).

1. Mobile overrides live in the **same module file**, in a `@media (max-width: 768px)` block at the bottom. Desktop styles are the base.
2. **Touch targets ≥ 44px** for buttons, inputs, tappable rows. The kit already does this for `Button`, `IconButton`, `Field` controls, `Checkbox`, `MenuItem`, `Tabs` and clickable table rows — don't undo it.
3. **Inputs/textarea `font-size: 16px` minimum** on mobile (iOS zooms otherwise). Kit controls already comply; any non-kit input must too.
4. Full-height surfaces use `100dvh` with a `100vh` fallback line before it.
5. Fixed/full-screen chrome pads with `env(safe-area-inset-top|bottom, 0px)` (`viewport-fit=cover` is set).
6. Side panels or docked surfaces that don't fit become full-screen overlays (`position: fixed; inset: 0`) with their own close control (see `Modal`, `components/assistant/AssistantPanel.module.css`). Z-index via the `--z-*` tokens.
7. No horizontal page scroll. Tables scroll inside their own wrapper (`DataTable`/`Table` do this); drop secondary columns with `hideOnMobile`; flex rows wrap or stack.
8. Stats grids go to 2 columns at ≤768; crowded toolbars collapse labels to icons at 480 (keep `aria-label`, use `IconButton`).

**When unsure, ask before building.** If the mobile treatment isn't obvious from these rules or an existing pattern (should this table become cards? should this go full-screen? what is hidden on a narrow phone?), stop and ask the user, with 2–3 concrete options and a short sketch. Obvious cases don't need a question.

## Changing the design

The design is meant to be changed in one place.

- **A value** (a colour, radius, spacing, font) → change the token in `src/globals.css` `:root`. Everything follows.
- **A pattern** (how all tables, buttons, chips, cards look) → change that component's `ui/X.module.css` (or `ui/X.tsx` for structure). Every page follows.
- **A status colour** → the map in `ui/status.ts`.
- **A new pattern** → add a new kit component: `ui/X.tsx` + `X.module.css` + `X.test.tsx`, tokens only, variants as props, native props spread, export it from `ui/index.ts`, add a row to `ui/README.md` and an entry in this skill.
- **Never fork a pattern**: no page-local table/button/badge/card CSS, no "slightly different" copy of a kit component, no overriding kit classes from a page module. If a page genuinely needs a variant, add it to the kit as a prop.
- Legacy global classes (`.btn`, `.form-group`, `.data-table`, `.status`, `.card`, …) still exist for unmigrated screens only. Don't use them in new or migrated code; use the kit.

## Token check

`npm run lint` runs `scripts/check-design-tokens.mjs` after ESLint. It flags, outside `src/globals.css`, `src/components/ui/**` and tests: hex colours, `rgb/rgba/hsl` colours, any `font-family` that isn't exactly one token (`var(--font-sans|display|mono)`; `--font-body|heading` pass during migration only), `box-shadow` that isn't `none` or a `var(--…)`, and `style={` in `.tsx`. It is warn-only now and becomes strict (fails lint) at the end of Stage 5. Code you touch must produce zero new findings — read the finding list, don't just check the exit code.

## Checklist for any UI change

- [ ] Used kit components for every pattern they cover; imported from `components/ui`.
- [ ] Page module CSS is layout only (grid/flex/gap/margins with `--space-*`); no colours, fonts, borders, radii or shadows on kit-owned patterns; no kit classes overridden.
- [ ] Zero inline `style={}`; every value a `var(--…)` token.
- [ ] Status via `StatusChip status={x}`; amounts/quantities `mono` + right-aligned; doc numbers via `DocNumber`.
- [ ] Forms: `Field` with `error` and `required` props, auto-wired child or `htmlFor` for wrappers, bare `Checkbox`, `Button loading` on submit.
- [ ] Icons via `Icon`/`IconButton`; no emoji, no inline SVG in pages.
- [ ] Copy: sentence case, no filler, no AI tropes, no terminal leftovers; mono only for numbers.
- [ ] Mobile at 768 and 375: no horizontal scroll, ≥44px targets, 16px inputs, `hideOnMobile` on secondary columns, full-screen modals/panels, `dvh` + safe-area where fixed.
- [ ] `npm run lint` clean, including no new design-token findings in files you touched.
- [ ] Looks native beside the dashboard, a list page and a form — compare side by side.
