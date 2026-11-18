# ui kit

One component per UI pattern. Import from `components/ui` (status helpers from `components/ui/status`). Usage rules and props: `.claude/skills/frontend-design/SKILL.md`.

| Component | Use it for |
|---|---|
| `Button` | Every text button and button-styled link (`to` for routes, `href` for external, `loading` for submits) |
| `IconButton` | Icon-only buttons (close, menu, bell); `label` becomes the accessible name |
| `Icon` | Every line icon; add new glyphs here, never inline an SVG in a page |
| `GoogleIcon` | The Google logo on sign-in buttons (brand colours, token-check allowlisted) |
| `Card` | Any surface panel or section, with optional title, count pill and actions |
| `StatCard` | A single headline number with a label; `tone="highlight"` for the one key stat |
| `Meter` | A segmented bar with legend (e.g. available vs rented stock) |
| `PageHeader` | The title row at the top of every page, with optional eyebrow and actions |
| `EmptyState` | "Nothing here" states: one short title and at most one action |
| `StatusChip` | Every status badge; tone comes from `status.ts` |
| `DocNumber` | Bill, challan and other document numbers, optionally linked |
| `DataTable` | Read-only list data from an array of rows |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` | Hand-built tables and editable grids (challan/bill item rows) |
| `Field` | Label + control + hint + error wrapper for one form control |
| `Input`, `Select`, `Textarea` | Form controls (forwardRef, work with `register()`) |
| `Checkbox` | A checkbox with its own label |
| `Fieldset` | A titled group of related fields or checkboxes |
| `FilterBar` | The wrapping row of search and filter controls above a list |
| `Menu`, `MenuItem`, `MenuLabel`, `MenuDivider` | Dropdown menus (business switcher, profile, row actions) |
| `Modal` | Dialogs; full-screen on phones |
| `Tabs` | Tab navigation within a page |
| `Spinner` (`LoadingSpinner`) | Loading state for a page or panel |
| `ErrorMessage` | API/load errors with optional retry |
