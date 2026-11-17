# ui kit

One component per UI pattern. Import from `components/ui` (status helpers from `components/ui/status`). Usage rules and props: `.claude/skills/frontend-design/SKILL.md`.

| Component | Use it for |
|---|---|
| `Button` | Every text button and button-styled link (`to` for routes, `href` for external, `loading` for submits, `aria-pressed` for toggles, `collapseLabel` for icon-only on phones, `dot` status-tone dot and `hint` shortcut kbd, `size="lg"` on auth forms) |
| `IconButton` | Icon-only buttons (close, menu, bell, mic) or an `Avatar` trigger; `size="sm"` (24px, 44px hit area on touch) for tight spots such as a thumbnail's remove; `tone="danger"` for an active hazard state such as recording; `label` becomes the accessible name |
| `Avatar` | Initials badge: `person` (account) or `business` (letter badge); non-interactive, put it in a trigger |
| `Notice` | Inline form/page message (sign-in error, "link sent"); `danger` is an alert, others a status |
| `Icon` | Every line icon; add new glyphs here, never inline an SVG in a page |
| `GoogleIcon` | The Google logo on sign-in buttons (brand colours, token-check allowlisted) |
| `Card` | Any surface panel or section, with optional title, count pill and actions |
| `StatCard` | A single headline number with a label; `tone="highlight"` for the one key stat |
| `Meter` | A segmented bar with legend (e.g. available vs rented stock) |
| `ProgressBar` | A determinate progress bar for a running job (takes the surrounding text colour, e.g. inside a `Notice`) |
| `PageHeader` | The title row at the top of every page, with optional eyebrow, actions and a `badge` beside the title |
| `EmptyState` | "Nothing here" states: one short title and at most one action |
| `StatusChip` | Every status badge; tone comes from `status.ts` |
| `DocNumber` | Bill, challan and other document numbers, optionally linked; `wrap` lets a long code wrap in a narrow sidebar |
| `DataTable` | Read-only list data from an array of rows (column flags `align`, `mono`, `nowrap`, `hideOnMobile`); `mobile` spec turns it into a two-line list on phones (`actionsPlacement: 'trailing'` puts row actions top-right instead of below) |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` | Hand-built tables and editable grids (challan/bill item rows); `aria-label`/`caption` name the table; `Tr stackOnMobile` stacks an editable grid row on phones (one divider per row; the page places cells with grid areas) |
| `Field` | Label + control + hint + error wrapper for one form control; `labelAction` for a link on the label row |
| `Input`, `Select`, `Textarea` | Form controls (forwardRef, work with `register()`); `size="lg"` on Input/Select for auth forms; Select draws the kit chevron |
| `Checkbox` | A checkbox with its own label |
| `Fieldset` | A titled group of related fields or checkboxes |
| `SearchInput` | The search box of a list page (icon, optional shortcut hint such as `/`); forwards its ref |
| `FilterBar` | The wrapping row of search and filter controls above a list |
| `SegmentedControl` | A 2–4 option single-choice filter shown inline (All / Delivery / Return); radio group |
| `RowActions` | A table/phone row's actions: one primary `Button` + a "More actions" menu for the rest (danger items supported; an item's `hint` shows a muted line under its label, e.g. why it's disabled); clicks never open the row |
| `Menu`, `MenuItem`, `MenuLabel`, `MenuDivider` | Dropdown menus (business switcher, profile, row actions, notifications; `MenuItem unread` tints new items) |
| `Modal` | Dialogs; full-screen on phones |
| `Tabs`, `TabPanel` | Tab navigation within a page; optional `count` per tab; `idPrefix` + `TabPanel` wire tab ↔ panel |
| `Spinner` (`LoadingSpinner`) | Loading state for a page or panel |
| `ErrorMessage` | API/load errors with optional retry |

Detail pages are composed from `components/DetailPageShell` (`DetailPageShell`, `DetailSection`, `DetailField`) and `components/EditableField`, which are built on this kit — see "Detail page" in the skill.

```tsx
<DetailPageShell title="Mehta Builders" eyebrow="Party" code="MEHT" status="active"
  backTo="/parties" backLabel="Parties" tabs={TABS} activeTab={tab} onTabChange={setTab} idPrefix="party"
  sidebar={<DetailSection title="Details"><DetailField label="Code" value="MEHT" mono /></DetailSection>}>
  <DetailSection title="Contact"><DetailField label="Email" value={undefined} /></DetailSection>
</DetailPageShell>
```

Formatters for amounts and dates live in `src/utils/format.ts` (`formatMoney`, `formatDate`), not in the kit.
