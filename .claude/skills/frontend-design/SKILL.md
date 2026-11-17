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
5. **Monospace only for numbers:** amounts, quantities, counts, codes, phone/GST, document numbers. Always with `tabular-nums` (the `mono` props and the global `.mono` class do this). Never monospace for labels, body, headings, dates (cells, phone meta, date inputs: text font everywhere) or the "Not added" placeholder (the kit keeps it in the text font).
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

**Type scale:** `--text-xs 12` · `--text-sm 13` (labels) · `--text-base 14` (body) · `--text-md 16` (card titles) · `--text-lg 20` · `--text-xl 28` · `--text-2xl 36` (page title) · `--text-ui-lg 15` (large controls only: `size="lg"` buttons and inputs).

**Space:** `--space-1 4` · `-2 8` · `-3 12` · `-4 16` · `-5 20` · `-6 24` · `-8 32` · `-10 40` · `-14 56`.

**Radius:** `--radius-sm 4` (kbd hints, tiny inline chips) · `--radius-md 6` (buttons, icon buttons, inputs/selects/textareas, menu items) · `--radius-lg 12` (cards, tables) · `--radius-xl 16` (modals, auth panel) · `--radius-full` (chips, avatars, pills).

**Elevation:** `--shadow-sm/md/lg` are `none` (surfaces are flat) · `--shadow-pop` (menus, popovers, modals only) · `--shadow-accent` (primary button hover) · `--ring-focus` (3px accent-muted ring on inputs) · `--mask-solid` (opaque stop for CSS masks; only its alpha matters).

**Motion:** `--ease-out` · `--transition-fast .15s` · `--transition-default .2s` · `--duration-enter .45s`. Entrance animations use fill-mode `backwards` (so hover transforms still work). Everything is disabled under `prefers-reduced-motion` (global rule). No scroll-driven animation.

**Layout:** `--header-height 56` · `--sidebar-width 232` · `--content-max 1200` · `--page-pad 40` (16 at ≤768).

**Z-index:** `--z-sticky 10` · `--z-sidebar-overlay 99` · `--z-sidebar 100` · `--z-popover 150` · `--z-panel 200` · `--z-modal 300` · `--z-menu 400` (portalled Menu panels, above Modal). Use the token, never a raw number.

## Component catalogue (`src/components/ui`)

Import from the barrel: `import { Button, Card, DataTable } from '../components/ui';`. Non-component helpers come from their module: `import { statusTone, statusLabel } from '../components/ui/status';`. These accept and spread their native element's props (`id`, `aria-*`, `data-*`, handlers; `className` is merged): `Button`, `IconButton`, the `Field` family (`Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `Fieldset`), the `Table` primitives (`Tr`, `Th`, `Td`), `FilterBar`, and the `Menu` parts (`Menu`, `MenuItem`, `MenuLabel`, `MenuDivider`). The others take only the props listed below. The one-line "when to use" table is `src/components/ui/README.md`.

### Actions

- **`Button`** — every text button and button-styled link. `variant`: `'primary' | 'secondary' | 'ghost' | 'danger'` (default `secondary`) · `size`: `'sm' | 'md' | 'lg'` (`lg` = 44px / `--text-ui-lg` 15px, auth forms only) · `icon?: IconName` (leading) · `loading?` (disables, shows a spinner, keeps width and accessible name, sets `aria-busy`) · `collapseLabel?` (with `icon`: at ≤768 the label is visually hidden but stays the accessible name, and the button becomes a 44px square — e.g. the header "Ask") · `dot?: 'info' | 'warning' | 'success' | 'danger'` (8px status dot before the label) · `hint?: string` (shortcut kbd after the label, hidden at ≤768; decorative — wire the key with `useHotkey`) · `to?` (renders a router `Link`) · `href?` (renders `<a>`) · native button props. Default `type="button"`; pass `type="submit"` in forms. `disabled`/`loading` links are inert (`aria-disabled`, `tabIndex -1`, click prevented). One primary per view. A button disabled until the user does something says why: a short muted line beside it (e.g. "Pick both dates", `--text-xs` `--text-muted`) linked from the button with `aria-describedby` while disabled (`hint` is the shortcut kbd, not a reason).
  - Toggle buttons: pass `aria-pressed`. Pressed reads as accent in every variant (secondary: accent-muted fill + accent border/text; ghost: `--bg-elevated` + accent text; primary: `--accent-hover`). Never restyle the pressed state from a page.
  ```tsx
  <Button variant="primary" type="submit" loading={isSaving}>Save bill</Button>
  <Button icon="plus" to="/challans/new">New challan</Button>
  ```
- **`IconButton`** — icon-only buttons. `label` (required → `aria-label`) · `icon: IconName` **or** `children` (a non-interactive glyph such as an `Avatar`, e.g. the account menu trigger) · `badge?: boolean` (accent dot) · `size?: 'sm'` (24px with a 14px icon; keeps a 44px invisible hit area at ≤768; for tight spots like a thumbnail corner) · `tone?: 'danger'` (danger tint for an active hazard state, e.g. recording; pair with a changed icon/label) · native button props. 36px, 44px at ≤768.
- **`Avatar`** — initials badge. `initials` · `size?: 'sm' | 'md'` (24 / 32px, default `md`) · `variant?: 'person' | 'business'` (`person` = round neutral, default; `business` = 6px-radius accent-muted letter badge) · `className?`. A non-interactive `aria-hidden` span: put it inside an `IconButton` or `Button`, which owns the accessible name and the 44px tap area.
  ```tsx
  <Menu trigger={p => <IconButton label="Account" {...p}><Avatar initials="SY" /></IconButton>}>…</Menu>
  ```
- **`Icon`** — `name: IconName` · `size?` (default 16) · `className?`. Always `aria-hidden`; put the accessible name on the control. Names: `dashboard inventory parties agreements challans bills payments team search bell chat chevron-down plus close menu more arrow-left arrow-right rupee settings logout brand paperclip mic stop`.
- **`GoogleIcon`** — Google's multi-colour logo for sign-in buttons only. `size?` (default 18) · `className?`. The only file allowed literal colours (token-check allowlist).

### Surfaces and page structure

- **`PageHeader`** — top of every page. `title` · `eyebrow?: ReactNode` (small accent line above the title in the text font — wrap only a code or number in `<span className="mono">`; real context only, e.g. today's date on the dashboard or the entity type on a detail page, never a slogan) · `actions?: ReactNode` · `badge?: ReactNode` (beside the title, e.g. the detail page's `StatusChip`). No subtitle prop, by design.
- **`Card`** — any panel or section. `title?` · `count?: number` (pill after the title) · `countTone?: 'neutral' | 'danger'` · `actions?: ReactNode` (right of the title, e.g. an "All bills" link) · `padded?` (default `true`; pass `padded={false}` when the body is a table) · `to?` (whole card becomes a link with hover lift; then don't put links or buttons inside it) · `className?`.
- **`StatCard`** — one headline number. `label` · `value: ReactNode` (rendered mono) · `icon?` · `tone?: 'default' | 'highlight'` (accent tint; at most one per screen) · `to?` · `children?` (e.g. a `Meter`).
- **`Meter`** — segmented bar + legend. `segments: { value: number; tone: 'accent' | 'info' | 'warning' | 'danger'; label: string }[]`. Values formatted `en-IN`; bar has an `aria-label` summary. Widths are rounded once and laid end to end (the last takes the remainder), so there are no hairline gaps.
- **`ProgressBar`** — determinate progress for a running job. `value` · `max` · `label` (accessible name) · `className?` (placement). Fill and track use the surrounding text colour, so put it inside a `Notice` of the right tone; the width is an SVG attribute (no inline style).
- **`EmptyState`** — `title` (one short line saying what's missing) · `action?: ReactNode` (at most one, usually a `Button`). No prose paragraph.
- **`Tabs`** — `tabs: { id; label; count?: number }[]` (`count` renders muted mono after the label; the tab's accessible name becomes e.g. "Bills 12"). The row scrolls sideways with no visible scrollbar; while it overflows and isn't scrolled to the end, the trailing edge fades (mask with `--mask-solid`). · `activeTab` · `onChange(id)` · `idPrefix?: string` (unique per page; tabs get `id="{prefix}-tab-{id}"` + `aria-controls="{prefix}-panel-{id}"`). Underline-accent style. Keyboard: Left/Right move between tabs (roving tabindex), Home/End jump to first/last. With `idPrefix`, wrap the active tab's content in **`TabPanel`** — `idPrefix` · `tabId` · `className?` (placement) · `children`; renders `role="tabpanel"`, labelled by its tab, focusable.
  ```tsx
  <Tabs idPrefix="party" tabs={TABS} activeTab={tab} onChange={setTab} />
  <TabPanel idPrefix="party" tabId={tab}>{tab === 'bills' ? <BillsTab /> : <ChallansTab />}</TabPanel>
  ```
- **`Modal`** — `isOpen` · `onClose` · `title` · `children` · `size?: 'default' | 'form'` (wider, for forms) · `variant?: 'delivery' | 'return'` (challan flows only; coloured top edge). Autofocuses the first field; Escape and overlay click close (an Escape a nested widget already handled with `preventDefault`, e.g. an open `Menu`, is ignored); full-screen with safe-area padding at ≤768. Never build an ad-hoc overlay.
- **`Spinner`** (alias `LoadingSpinner`) — `message?` (default "Loading…"; `""` hides the line when an adjacent title already says what is loading). Accent ring + message in a `role="status"` region; static under reduced motion. Page/panel loading.
- **`ErrorMessage`** — `error: unknown` (run through `getErrorMessage`) · `onRetry?`. Load/API errors.
- **`Notice`** — inline message inside a form or panel. `tone: 'success' | 'info' | 'warning' | 'danger'` · `title?` · `children` · `className?` (placement). `danger` renders `role="alert"`, the others `role="status"`. Use it for a failed submit ("Invalid login credentials") or a confirmation ("Reset link sent"); never the legacy `.error-message` class or a bare `<p role="status">`. Page load failures with retry stay `ErrorMessage`.

### Data

- **`DataTable<T>`** — list data from an array. `columns: Column<T>[]` where `Column = { key; header; render?(row); align?: 'left' | 'right'; mono?; nowrap?; hideOnMobile? }` · `rows: T[]` · `rowKey(row): string` · `onRowClick?(row)` (rows become focusable, Enter activates) · `empty?: ReactNode` (defaults to `EmptyState title="Nothing here yet"`; pass a specific one) · `aria-label?` (names the table and the phone list) · `mobile?: DataTableMobile<T>`. Without `render`, the cell shows `row[key]`. Owns the horizontal-scroll wrapper.
  - **`mobile`** (phone list mode) — `{ title(row); leading?(row); badge?(row); subtitle?(row); meta?(row): ReactNode[]; actions?(row); actionsPlacement?: 'below' | 'trailing' }`, each returning a `ReactNode`. At ≤768 the table is hidden and a `<ul>` renders instead, one item per row: **line 1** = `leading` + `title`, `badge` pushed right; **line 2** = `subtitle` (heading colour), then `meta` parts joined with " · " (null/undefined/false/'' parts are skipped); **`actions`** below (e.g. a `Button size="sm"` Confirm); `actionsPlacement: 'trailing'` instead puts the actions top-right on line 1 after any badge (use for a lone `RowActions` menu with no primary button). Tapping an item (or Enter on it) calls `onRowClick`; buttons/links/controls inside never do. Above 768 nothing changes. Without `mobile`, phones keep the scrolling table with `hideOnMobile` columns dropped. Both views are in the DOM (CSS picks one), so tests see table cells and list items.
  - What goes where: `title` = the row's identity (doc number via `DocNumber`, or party/item name) · `leading` = a type dot or icon · `badge` = `StatusChip` · `subtitle` = the second identity (party name under a doc number) · `meta` = short facts (site code, `formatDate(…)`, "4 items", `formatMoney(…)`) · `actions` = the row's inline action buttons, if the desktop row has them. Every fact needed to identify the row and act on it must appear somewhere in the spec.
- **`Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`** — hand-built tables and editable grids (challan/bill item rows). `Th`/`Td`: `align?: 'left' | 'right' | 'center'` · `mono?` · `hideOnMobile?` · native cell props. `Tr`: `onClick?: (e: MouseEvent | KeyboardEvent) => void` makes the row clickable (focusable; fires on click and on Enter; only clickable rows get the hover highlight). `stackOnMobile?` (editable grids, e.g. challan items): at ≤768 the row becomes a CSS grid with a single divider under the whole row and compact cells without their own dividers; the page module only places cells (`grid-template-areas` on the row's class, `grid-area` on cell classes) and hides the header row, so the grid never scrolls sideways on a phone. `Table`: `className?` (placement) · `aria-label?` · `caption?: ReactNode` (visually hidden `<caption>`). Name a table with one of them when no visible heading does.
- Table rules: amounts and quantities `mono` + `align="right"`; codes and doc numbers `mono`; dates and periods are **not** mono (text font); short fixed-width columns (doc number, date, period, status) `nowrap` so they never break onto two lines (`DocNumber` is always nowrap); secondary columns (`Due`, `Site`, `Created by`) `hideOnMobile`. Buttons, links, inputs, selects and labels inside a clickable row handle their own click and **do not** trigger the row click — put row actions (a `Menu`, a `Button`) straight in a cell. Tables have no frame of their own: put them in `Card padded={false}`.
- **`RowActions`** — `primary?: ReactNode` (the one contextual action, a `Button size="sm"`) · `items: { label; onClick; tone?: 'danger'; disabled?; icon?; hint? }[]` (`hint` = a muted second line under the label, also the item's accessible description — use it to say why an item is disabled) (rendered in a "More actions" `Menu`; omitted when empty). Right-aligned, no wrapping, stops click propagation so the row click never fires. Use it in an `Actions` column (`align: 'right'`, `nowrap: true`) and as the `mobile.actions` of the same table; don't line up 3+ buttons per row.
- **`StatusChip`** — every status badge, always `<StatusChip status={bill.status} />`. Tone comes from the single map in `ui/status.ts` (`paid/active/confirmed/completed/accepted/present` → success · `sent/delivery/leave` → info · `partial/pending/return/half-day` → warning · `created` (audit) → success · `updated` (audit) → warning · `deleted` (audit) → danger · `overdue/failed/cancelled/terminated/declined/absent/revoked/suspended` → danger · anything else, e.g. `draft/expired/inactive`, → neutral; case-insensitive, never throws). Legacy `.status-*` classes in `globals.css` use the same tones (`.status-draft` is neutral). Label is the status in sentence case (`partially_paid` → "Partially paid"); `children` overrides it (e.g. `"12 days"`). To change a status colour, edit the map in `ui/status.ts` — never pass `tone` at a call site for a lifecycle status. `title?` adds a native tooltip. `title?` adds a native tooltip. `tone?: 'success' | 'info' | 'warning' | 'danger' | 'neutral'` is only for chips that are not lifecycle statuses.
- **`DocNumber`** — bill/challan/agreement numbers. `value` · `to?` (link to the document) · `wrap?` (let a long code wrap in a narrow sidebar `DetailField`; default nowrap). Mono.

### Forms

- **`Field`** — label + control + hint + error. `label` · `hint?` · `error?` · `required?` · `htmlFor?` · `labelAction?: ReactNode` (right-aligned on the label row, outside the `<label>`, e.g. a "Forgot?" link; links in it are styled by the kit) · div props. 
  - Auto-wiring: when its **single child** is `Input`, `Select`, `Textarea`, `Checkbox` or a native `input/select/textarea`, Field gives it an id (keeps an existing one), links the label, and sets `aria-describedby` (hint + error). For wrapper children (an input + button row, a custom autocomplete) pass `htmlFor` and put that id on the inner input yourself.
  - Pass the message as `error` on Field once; it renders a `role="alert"` line and sets `aria-invalid` on an auto-wired child. Don't also pass `invalid` or render your own error text.
  - Use the `required` prop (adds an `aria-hidden` marker and sets `required` + `aria-required="true"` on the auto-wired control). Never write a literal `*` in label text.
- **`Input`, `Select`, `Textarea`** — `forwardRef` (work with `register()`), native props plus `mono?` (numeric/amount/code inputs) and `invalid?` (only when not inside a `Field` with `error`). `Input`/`Select` also take `size?: 'md' | 'lg'` (`lg` = 44px / 15px, auth forms; replaces the native numeric `size` attribute). 44px / 16px font at ≤768. `Select` draws a token chevron (`appearance: none`; never add your own arrow). `readOnly` inputs render as a quiet card-coloured box (value readable, no focus ring); `disabled` dims to 60% with a not-allowed cursor.
- **`Checkbox`** — `label?` + native input props (forwardRef). Use it bare: `<Checkbox label="Include GST" {...register('gst')} />`, not inside `Field`. Several related checkboxes → group them in a `Fieldset`.
- **`Fieldset`** — `legend` + native fieldset props. Titled group of fields or checkboxes; looks the same as legacy `.form-fieldset` (card background, 12px radius, muted legend).
- **`FilterBar`** — wrapping row above a list for search and filter controls (children stack full width at ≤480). Div props.
- **`SearchInput`** — the search box of a list page. `label: string` (required → `aria-label`) · `hint?: string` (shortcut kbd at the right, e.g. `/`, hidden at ≤768) · native input props (`value`, `onChange`, `placeholder`…) · forwards `ref` to the `<input type="search">`; `className` goes on the wrapper (placement only). 38px, 44px / 16px font at ≤768. Place it first inside `FilterBar`, which sizes it (grows from 240px, max 360); anywhere else it is content-sized, so it is safe in a column container too.
- **`SegmentedControl<V extends string>`** — single-choice filter with 2–4 short options shown inline. `options: { value: V; label: ReactNode; dot?: 'info' | 'warning' | 'success' | 'danger' }[]` · `value: V` · `onChange(v: V)` · `label: string` (accessible group name). A `role="radiogroup"` of `role="radio"` buttons with `aria-checked`; arrow keys (and Home/End) move and select, only the checked option is tabbable. Stretches full width at ≤768 (44px options). Use it for a type/state switch everyone uses (All / Delivery / Return); longer or rarer option lists stay a `Select`.
  ```tsx
  <SegmentedControl label="Type" value={type} onChange={setType}
    options={[{ value: 'all', label: 'All' }, { value: 'delivery', label: 'Delivery', dot: 'info' }, { value: 'return', label: 'Return', dot: 'warning' }]} />
  ```

### Menus

- **`Menu`** — `trigger: (props) => ReactNode` (spread `props` onto a `Button` or `IconButton`; it carries `onClick`, `aria-expanded`, `aria-haspopup`, `aria-controls` and the ref) · `align?: 'start' | 'end'` (default `end`) · `className?` (on the root wrapper around trigger + panel — placement only) · `menuClassName?` (on the `role="menu"` panel) · other native div props (go to the panel, e.g. `aria-label`) · `children`. The panel is portalled to `document.body` and fixed-positioned from the trigger (flips above when there is no room below; closes on scroll, repositions on resize), so table wrappers and cards never clip it; its z-index is `--z-menu` (above `--z-modal`, so a menu opened inside a Modal shows over it). Closes on outside click, Escape and Tab; returns focus to the trigger; arrow keys, Home and End move between items (ArrowUp with nothing focused → last item). Escape is `preventDefault`ed, so a Menu inside a `Modal` closes only the Menu. At ≤480 the panel spans the viewport width (16px gutters) under the trigger.
- **`MenuItem`** — `onSelect?` (or `to?` for a router link) · `unread?` (accent tint + leading bar, e.g. unread notifications; sets `data-unread`) · native button props. Closes the menu after select. `aria-disabled` items never run `onClick`/`onSelect` and never navigate. **`MenuLabel`** (small heading inside a menu), **`MenuDivider`**.
  ```tsx
  <Menu trigger={p => <IconButton label="More actions" icon="menu" {...p} />}>
    <MenuItem to={`/bills/${bill._id}`}>Open</MenuItem>
    <MenuDivider />
    <MenuItem onSelect={() => setDeleting(bill)}>Delete</MenuItem>
  </Menu>
  ```
- Never build a dropdown with your own state and absolute positioning.

## Recipes

**List page** = `PageHeader` + `FilterBar` + `Card padded={false}` holding a `DataTable` with a `mobile` spec.
```tsx
import { formatDate, formatMoney } from '../utils/format';

<PageHeader title="Bills" actions={<Button variant="primary" icon="plus" onClick={openCreate}>New bill</Button>} />
<FilterBar>
  <Input type="search" placeholder="Search bills" aria-label="Search bills" value={q} onChange={e => setQ(e.target.value)} />
  <SegmentedControl label="Type" value={type} onChange={setType} options={TYPE_OPTIONS} />
  <Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>…</Select>
</FilterBar>
<Card padded={false}>
  <DataTable
    aria-label="Bills"
    columns={[
      { key: 'billNumber', header: 'Bill', render: b => <DocNumber value={b.billNumber} /> },
      { key: 'party', header: 'Party', render: b => b.partyName },
      { key: 'dueDate', header: 'Due', mono: true, hideOnMobile: true, render: b => formatDate(b.dueDate) },
      { key: 'total', header: 'Amount', mono: true, align: 'right', render: b => formatMoney(b.total) },
      { key: 'status', header: 'Status', render: b => <StatusChip status={b.status} /> },
    ]}
    mobile={{
      title: b => <DocNumber value={b.billNumber} />,
      badge: b => <StatusChip status={b.status} />,
      subtitle: b => b.partyName,
      meta: b => [`Due ${formatDate(b.dueDate)}`, <span key="amt" className="mono">{formatMoney(b.total)}</span>],
      actions: b => b.status === 'draft' && <Button size="sm" onClick={() => send(b)}>Send</Button>,
    }}
    rows={bills}
    rowKey={b => b._id}
    onRowClick={b => navigate(`/bills/${b._id}`)}
    empty={<EmptyState title="No bills yet" action={<Button onClick={openCreate}>New bill</Button>} />}
  />
</Card>
```
Loading → `Spinner`; error → `ErrorMessage onRetry={refetch}`.

**Dashboard** = `PageHeader` (eyebrow for real context) + a layout grid (page CSS) of `StatCard`s and `Card`s. Sections are `Card title=… count=… actions=…`; lists inside are `DataTable` in `Card padded={false}`.

**Detail page** = `DetailPageShell` + `DetailSection` + `DetailField` from `components/DetailPageShell` (built on `PageHeader`, `StatusChip`, `Tabs`/`TabPanel`, `Card` and `EditableField`).
- `DetailPageShell` — `title` · `eyebrow?` (entity type) + `code?` → eyebrow "Party · MEHT" (only the code is mono) · `status?` (one `StatusChip` beside the title; never repeat status in the sidebar) · `statusTone?` (non-lifecycle chips only) · `backTo` + `backLabel` (back link "← Parties", accessible name "Back to Parties") · `isLoading?` + `loadingLabel?` (Spinner message, default "Loading…") · `error?` + `onRetry?` (ErrorMessage) · `headerActions?: ReactNode` · `tabs?: { id; label; count? }[]` + `activeTab?` + `onTabChange?` (pass `activeTab` to control the tabs; omit it and the shell keeps its own state, starting on the first tab and still calling `onTabChange`) + `idPrefix?` (default `"detail"`) — `children` is wrapped in the active `TabPanel` · `sidebar?` (right column, 300px; below the main column at ≤768). Legacy `subtitle` shows as the eyebrow and `statusClassName` is ignored, so unmigrated pages keep working; don't use them in migrated pages.
- **Header actions:** at most one `variant="primary"` Button; at most two visible actions in total; everything else goes in a kit `Menu` (`IconButton label="More actions" icon="more"`). Destructive actions live in the menu.
- `DetailSection` — a `Card`: `title` · `count?` · `actions?` (e.g. `Button size="sm"` "Add site") · `padded?` (default `true`, sized for `DetailField` rows; `false` when the body is a `DataTable`). Legacy `headerActions` = `actions`. When every child is a labelled `DetailField` (fragments are fine), the body is one `<dl>` with a `<div>` per row; otherwise each field is its own `<dl>`. Rows have dividers between them, never after the last.
- `DetailField` — one `<dl>` label/value row: `label` (sentence case; `""` = full-width value, e.g. notes) · `value?: ReactNode` · `mono?` (codes, phone, GST, amounts, quantities) · `emptyText?` (default "Not added", muted, always text font even on a `mono` field) · `editable?: { rawValue; inputType: 'text'|'number'|'select'|'textarea'|'date'; options?; onSave(v) => Promise (call `.unwrap()`); isSaving?; prefix?; suffix?; renderEditInput?({ value, onChange, onSave(override?) }) }` → the value becomes an `EditableField` (muted "Edit" revealed on hover/focus; Enter saves, Escape cancels, moving focus out of the editor saves an input/select but moving it to the editor's own Save/Cancel does not; kit Save/Cancel buttons; API error shown under the input). Sidebar rows use a narrower label column automatically.
- `EditableField` on its own (table cells): `compact`, `label` = the input's accessible name. Its trigger bleeds into the container's padding (negative inline margin + matching width), so the value stays flush with the column header; keep the cell's normal padding (never zero it). In a right-aligned numeric column pass `align="right"` (value flush right, "Edit" hint before it, input right-aligned). `DetailField` values wrap long text/codes (`overflow-wrap: anywhere`).
```tsx
<DetailPageShell
  title={party.name} eyebrow="Party" code={party.code} status={party.isActive ? 'active' : 'inactive'}
  backTo="/parties" backLabel="Parties" isLoading={isLoading} error={error} onRetry={refetch}
  headerActions={<Button variant="primary" icon="plus" onClick={openBill}>New bill</Button>}
  tabs={[{ id: 'about', label: 'About' }, { id: 'bills', label: 'Bills', count: bills.length }]}
  activeTab={tab} onTabChange={setTab} idPrefix="party"
  sidebar={<DetailSection title="Details"><DetailField label="Code" value={party.code} mono /></DetailSection>}
>
  {tab === 'about' && (
    <DetailSection title="Contact">
      <DetailField label="Phone" value={party.contact.phone} mono
        editable={{ rawValue: party.contact.phone, inputType: 'text', onSave: v => save('phone', v), isSaving }} />
    </DetailSection>
  )}
</DetailPageShell>
```

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

**Auth page** (sign in, register, reset, invitation) = `AuthLayout` (`components/auth`: brand, `title` as the h1, optional `footer`, the scaffold drawing on the right; `children` optional) + a form laid out with `components/auth/AuthForm.module.css` (`.form` column, `.full` full-width buttons, `.divider` "or" rule). Every control is `size="lg"` (`Input`, `Button`); errors from the submit are `<Notice tone="danger">`, confirmations `<Notice tone="success">`; the switch link ("New here? Create account", "Back to sign in") goes in `footer`. All fields are required, so no `required` asterisks: put `aria-required="true"` on the inputs instead. Secondary links on a label row use `Field labelAction`.
```tsx
<AuthLayout title="Sign in" footer={<>New here? <Link to="/register">Create account</Link></>}>
  <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
    <Field label="Email" error={errors.email?.message}>
      <Input size="lg" type="email" autoComplete="email" aria-required="true" {...register('email')} />
    </Field>
    <Field label="Password" error={errors.password?.message} labelAction={<Link to="/forgot-password">Forgot?</Link>}>
      <Input size="lg" type="password" aria-required="true" {...register('password')} />
    </Field>
    {error && <Notice tone="danger">{error}</Notice>}
    <Button size="lg" variant="primary" type="submit" loading={isLoading} className={styles.full}>Sign in</Button>
  </form>
  <div className={styles.divider}>or</div>
  <Button size="lg" className={styles.full} onClick={google}><GoogleIcon />Continue with Google</Button>
</AuthLayout>
```

**Status** = `<StatusChip status={x} />`. Overdue-by-days: `<StatusChip status="overdue">{days} days</StatusChip>`.

**Amounts** = mono, right-aligned, `formatMoney(n)` from `src/utils/format.ts` (₹ prefix, Indian grouping, decimals only when non-integer: `₹1,84,200`, `₹99.50`). In a sentence: `<span className="mono">{formatMoney(amount)}</span>`. Never `toLocaleString()` without `'en-IN'`.

**Dates** = `formatDate(d)` from the same file: `16 Nov` this year, `16 Nov 2025` otherwise. Dates are text font everywhere: table cells, phone-list meta, `Input type="date"` (no `mono`).

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
