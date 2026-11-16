# ui kit

One component per UI pattern. Import from `components/ui` (status helpers from `components/ui/status`). Usage rules and props: `.claude/skills/frontend-design/SKILL.md`.

| Component | Use it for |
|---|---|
| `Button` | Every text button and button-styled link (`to` for routes, `href` for external, `loading` for submits, `aria-pressed` for toggles, `collapseLabel` for icon-only on phones, `dot` status-tone dot and `hint` shortcut kbd, `size="lg"` on auth forms) |
| `IconButton` | Icon-only buttons (close, menu, bell) or an `Avatar` trigger; `label` becomes the accessible name |
| `Avatar` | Initials badge: `person` (account) or `business` (letter badge); non-interactive, put it in a trigger |
| `Notice` | Inline form/page message (sign-in error, "link sent"); `danger` is an alert, others a status |
| `Icon` | Every line icon; add new glyphs here, never inline an SVG in a page |
| `GoogleIcon` | The Google logo on sign-in buttons (brand colours, token-check allowlisted) |
| `Card` | Any surface panel or section, with optional title, count pill and actions |
| `StatCard` | A single headline number with a label; `tone="highlight"` for the one key stat |
| `Meter` | A segmented bar with legend (e.g. available vs rented stock) |
| `PageHeader` | The title row at the top of every page, with optional eyebrow and actions |
| `EmptyState` | "Nothing here" states: one short title and at most one action |
| `StatusChip` | Every status badge; tone comes from `status.ts` |
| `DocNumber` | Bill, challan and other document numbers, optionally linked |
| `DataTable` | Read-only list data from an array of rows; `mobile` spec turns it into a two-line list on phones |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` | Hand-built tables and editable grids (challan/bill item rows); `aria-label`/`caption` name the table |
| `Field` | Label + control + hint + error wrapper for one form control; `labelAction` for a link on the label row |
| `Input`, `Select`, `Textarea` | Form controls (forwardRef, work with `register()`); `size="lg"` on Input/Select for auth forms; Select draws the kit chevron |
| `Checkbox` | A checkbox with its own label |
| `Fieldset` | A titled group of related fields or checkboxes |
| `SearchInput` | The search box of a list page (icon, optional shortcut hint such as `/`); forwards its ref |
| `FilterBar` | The wrapping row of search and filter controls above a list |
| `SegmentedControl` | A 2–4 option single-choice filter shown inline (All / Delivery / Return); radio group |
| `Menu`, `MenuItem`, `MenuLabel`, `MenuDivider` | Dropdown menus (business switcher, profile, row actions) |
| `Modal` | Dialogs; full-screen on phones |
| `Tabs`, `TabPanel` | Tab navigation within a page; `idPrefix` + `TabPanel` wire tab ↔ panel |
| `Spinner` (`LoadingSpinner`) | Loading state for a page or panel |
| `ErrorMessage` | API/load errors with optional retry |

Formatters for amounts and dates live in `src/utils/format.ts` (`formatMoney`, `formatDate`), not in the kit.
