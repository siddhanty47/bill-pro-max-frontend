# ui kit

One component per UI pattern. Import from `components/ui` (status helpers from `components/ui/status`). Usage rules and props: `.claude/skills/frontend-design/SKILL.md`.

| Component | Use it for |
|---|---|
| `Button` | Every text button and button-styled link (`to` for routes, `href` for external, `loading` for submits, `aria-pressed` for toggles, `collapseLabel` for icon-only on phones, `dot` status-tone dot and `hint` shortcut kbd, `size="lg"` on auth forms) |
| `IconButton` | Icon-only buttons (close, menu, bell, mic) or an `Avatar` trigger; `size="sm"` (24px, 44px hit area on touch) for tight spots such as a thumbnail's remove; `tone="danger"` for an active hazard state such as recording; `label` becomes the accessible name |
| `Avatar` | Initials badge: `person` (account) or `business` (letter badge); non-interactive, put it in a trigger |
| `Notice` | Inline form/page message (sign-in error, "link sent"); `danger` is an alert, others a status |
| `Icon` | Every line icon; add new glyphs here, never inline an SVG in a page |
| `NotAdded` | The muted "Not added" placeholder for an empty value in a table cell or custom row (`DetailField` uses it for empty values); always the text font, even in a mono cell |
| `TextLink` | An in-content router link (party name in a detail field, payment date in a table): accent, medium weight, explicit hover colour; not for buttons (`Button to`) or document numbers (`DocNumber to`) |
| `Dot` | An 8px decorative status-tone dot (challan type in a cell or phone-list `leading`; used by `Button dot` and `SegmentedControl`) |
| `NavCount` | Right-aligned count pill at the end of a sidebar nav link (`value`, `label?` suffix, `tone` neutral/danger, `description?` for the hidden screen-reader text); renders nothing for 0/undefined, caps at "999+" |
| `Brand` | The Bill Pro Max mark + wordmark for headers (`size`: `md` default, `sm`; `collapseName` shows the mark only at ≤480, wordmark stays readable to assistive tech); placement-only `className` |
| `GoogleIcon` | The Google logo on sign-in buttons (brand colours, token-check allowlisted) |
| `Card` | Any surface panel or section, with optional title, muted `subtitle` line, count pill and actions |
| `StatCard` | A single headline number with a label; `tone="highlight"` for the one key stat; `valueTone` (`positive`/`negative`/`warning`) colours the number; `value` optional for a children-only card |
| `Meter` | A segmented bar with legend (e.g. available vs rented stock); `hideLegend` drops the legend, tone `muted` is a neutral segment |
| `ChartCard` | A card around one chart: title, headline line, chart body (spinner / empty message) and range presets under it. Chart bodies live in `components/charts/` and are loaded with `React.lazy` |
| `ProgressBar` | A determinate progress bar for a running job (takes the surrounding text colour, e.g. inside a `Notice`) |
| `PageHeader` | The title row at the top of every page, with optional actions, a `badge` beside the title and a muted `subtitle` under it (only for context shown nowhere else) |
| `EmptyState` | "Nothing here" states: one short title and at most one action |
| `StatusChip` | Every status badge; tone comes from `status.ts` |
| `DocNumber` | Bill, challan and other document numbers, optionally linked; `wrap` lets a long code wrap in a narrow sidebar |
| `DataTable` | Read-only list data from an array of rows (column flags `align`, `mono`, `nowrap`, `hideOnMobile`); `mobile` spec turns it into a two-line list on phones (`actionsPlacement: 'trailing'` puts row actions top-right instead of below). Pages its rows 25 at a time (`pageSize` to change); pass `pagination={{ page, pageSize, total, onPageChange }}` when the server already returned one page. `rowLink={row => path}` makes rows clickable (overrides `onRowClick`) and makes the detail page's Prev/Next step through this table: the row and any `DocNumber`/`TextLink` in it pointing at that path carry the nav state. Server-paged challan/bill tables also pass `pagination.navSource` (their list args) so Prev/Next can fetch neighbouring pages |
| `Pagination` | The pager under a table ("Showing 26–50 of 132", Previous, page numbers, Next; "Page 2 of 6" on phones). Hidden when everything fits on one page. `DataTable` renders it for you |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` | Hand-built tables and editable grids (challan/bill item rows); `aria-label`/`caption` name the table; `Table dense` tightens cell padding for wide statement tables; `Tr variant="total"` marks a totals/balance row (top rule, heavier weight); `Tr stackOnMobile` stacks an editable grid row on phones (one divider per row; the page places cells with grid areas); `Td`/`Th` `tone` colours a value (balance due); `Table detail` uses DetailSection row insets (bill summary) |
| `Field` | Label + control + hint + error wrapper for one form control; `labelAction` for a link on the label row |
| `Input`, `Select`, `Textarea` | Form controls (forwardRef, work with `register()`); `size="lg"` on Input/Select for auth forms; `Input uppercase` for codes/GSTIN (display only); Select draws the kit chevron |
| `Checkbox` | A checkbox with its own label |
| `Fieldset` | A titled group of related fields or checkboxes |
| `SearchInput` | The search box of a list page (icon, optional shortcut hint such as `/`); forwards its ref; content-sized outside a `FilterBar` (no fixed flex basis) |
| `FilterBar` | The wrapping row of search and filter controls above a list |
| `SegmentedControl` | A 2–6 option single-choice filter shown inline (All / Delivery / Return); radio group; `size="sm"` for a compact control under a chart |
| `RowActions` | A table/phone row's actions: one primary `Button` + a "More actions" menu for the rest (danger items supported; an item's `hint` shows a muted line under its label, e.g. why it's disabled); clicks never open the row |
| `Menu`, `MenuItem`, `MenuLabel`, `MenuDivider` | Dropdown menus (business switcher, profile, row actions, notifications; `Menu width="wide"` for notifications; `MenuItem unread` tints new items, `MenuItem tone="danger"` for Delete) |
| `Modal` | Dialogs; full-screen on phones |
| `Tabs`, `TabPanel` | Tab navigation within a page; optional `count` per tab; `idPrefix` + `TabPanel` wire tab ↔ panel |
| `Spinner` | Loading state for a page or panel |
| `ErrorMessage` | API/load errors with optional retry |

Detail pages are composed from `components/DetailPageShell` (`DetailPageShell`, `DetailSection`, `DetailField`) and `components/EditableField`, which are built on this kit — see "Detail page" in the skill.

```tsx
<DetailPageShell title="Mehta Builders" status="active"
  backTo="/parties" backLabel="Parties" tabs={TABS} activeTab={tab} onTabChange={setTab} idPrefix="party"
  sidebar={<DetailSection title="Details"><DetailField label="Code" value="MEHT" mono /></DetailSection>}>
  <DetailSection title="Contact"><DetailField label="Email" value={undefined} /></DetailSection>
</DetailPageShell>
```

Formatters for amounts and dates live in `src/utils/format.ts` (`formatMoney`, `formatDate`, `formatDateTime`, `formatMonth`), not in the kit. The muted "Not added" placeholder for a table cell is the kit `NotAdded`.
