# Frontend feature docs

One doc per feature: pages, components, hooks, API files, tag invalidation, UX rules and tests.
`CLAUDE.md` is the short pointer layer; detail lives here. Backend rules for the same features:
`bill-pro-max-backend-v2/docs/features/README.md`.

**Rule:** every new feature or significant behaviour/architecture change adds or updates its doc
here, and this index, in the same PR.

- [change-gate-ui.md](change-gate-ui.md) — dry-run preview, `ChangeImpactDialog`, `useChangeGate`, `withGate` / `gatedTags`
- [bill-integrity-ui.md](bill-integrity-ui.md) — frozen bills, out-of-date drafts, draft auto notes, negative stock, `useBillIssueGate`
- [notes-ui.md](notes-ui.md) — credit/debit notes pages, form, tables, money helpers, PDFs
- [year-close-ui.md](year-close-ui.md) — `/year-close`, `useSiteLock`, closed-year locks, credit-note deadline
- [bill-generation-ui.md](bill-generation-ui.md) — single and bulk bill forms, GST mode per site
- [bulk-actions.md](bulk-actions.md) — multi-select, bulk bar, "Done" dialog with skip reasons, CSV export
- [dashboard.md](dashboard.md) — insights dashboard, charts, sidebar counts, party stock section
- [challan-photo-scan-ui.md](challan-photo-scan-ui.md) — scan a challan photo: camera vs gallery inputs, auto-fill, review panel
- [global-search.md](global-search.md) — header search (MiniSearch + document search), live index sync
- [design-system.md](design-system.md) — pointers to the `frontend-design` skill and the `ui/` kit

Testing: `TESTING.md` (repo root).
