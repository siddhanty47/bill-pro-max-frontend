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
- [business-settings.md](business-settings.md) — `/business` fields: contact, PAN, tax defaults, credit-note deadline, document terms and signatory
- [bill-generation-ui.md](bill-generation-ui.md) — single and bulk bill forms, GST mode per site
- [bulk-actions.md](bulk-actions.md) — multi-select, bulk bar, "Done" dialog with skip reasons, CSV export
- [party-credit-score-ui.md](party-credit-score-ui.md) — credit score section on the party page (score, band, unpaid by age)
- [dashboard.md](dashboard.md) — insights dashboard, charts, sidebar counts, party stock section
- [challan-delete-cancel-ui.md](challan-delete-cancel-ui.md) — delete a draft, cancel a confirmed challan (gated), bulk delete drafts
- [challan-photo-scan-ui.md](challan-photo-scan-ui.md) — scan a challan photo: camera vs gallery inputs, auto-fill, review panel
- [global-search.md](global-search.md) — header search (MiniSearch + document search), live index sync
- [agreement-pickers.md](agreement-pickers.md) — agreement selects/checkboxes are labelled by site code + full address (`siteLabel`), not agreement id
- [design-system.md](design-system.md) — pointers to the `frontend-design` skill and the `ui/` kit

Testing: `TESTING.md` (repo root).
