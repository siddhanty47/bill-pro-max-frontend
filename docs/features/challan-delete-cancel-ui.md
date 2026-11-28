# Deleting and cancelling challans (UI)

Backend rules: `bill-pro-max-backend-v2/docs/features/challan-delete-cancel.md`.

| Where | Draft | Confirmed | Cancelled |
|---|---|---|---|
| Challan page header | **Delete** → confirm dialog → `DELETE`, then back to `/challans` | **Cancel challan** → confirm dialog → gated `POST …/cancel` | nothing |
| Challans list, bulk bar | **Delete N** deletes it | **Delete N** cancels it when its dry run is clean; otherwise skipped: "needs a check, open it to cancel" (or "year closed") | skipped: "already cancelled" |

- API: `challanApi.deleteChallan` (`useDeleteChallanMutation`, invalidates `Challan`, `AuditLog`,
  `Dashboard`) and `challanApi.cancelChallan` (`useCancelChallanMutation`, `withGate` +
  `gatedTags`: `Challan`, `Bill`, `BillNote`, `AuditLog`, `Dashboard`, `Inventory`, `Party`).
- Cancel is gated: it runs through `useChangeGate`, so a cancel that touches a billed period shows
  `ChangeImpactDialog` (reason, negative stock, closed year). The confirm dialog closes before the
  gate runs, so the two dialogs never stack.
- Cancel challan is disabled while the site is locked (`useSiteLock`). Delete of a draft is never
  locked (a draft moved no stock).
- Staff lack the `delete` challan permission; the server's 403 shows as an alert (detail page) or
  a skip reason (bulk).
- Bulk delete: `useChallanBulkActions` (`runDelete`, `cancelOne`, `runBulk`, "Done" dialog). N counts drafts + confirmed. Each confirmed challan is dry-run first (like bulk confirm): a cancel that would touch a sent bill, need a reason or confirm negative stock never runs in bulk. The confirm dialog says how many are deleted and how many cancelled; the "Done" dialog reads e.g. "2 deleted, 1 cancelled".
- Confirms use the kit dialog (`useConfirm`), never `window.confirm`.
- Tests: `ChallanDetailPage.test.tsx` (delete, cancel through the gate, failures),
  `ChallansPage.test.tsx` (bulk delete with skips).
