# Bill integrity UI

How the frontend shows frozen bills, out-of-date drafts, draft auto notes and negative stock, and
how it guards sending a draft.

## Rules

- **Issued** = status not `draft`/`cancelled` (`isIssued`, `src/utils/billStatus.ts`). Issued bills
  show no delete, regenerate or refresh.
- Status moves offered by `canChangeStatus` mirror the backend: `draft → sent | cancelled`, any
  move among `sent | partial | paid | overdue`; nothing back to draft; an issued bill is never
  cancelled.
- Money shown anywhere for a bill (bill page, bills list, party bills tab, payment form, portal)
  goes through `effectiveAmount` (total + `notesTotal`) and `balanceDue` in `src/utils/billMoney.ts`.

## Notices (`src/components/BillIntegrity.tsx`, `BillIntegrityNotices`)

| Condition | Notice |
|-----------|--------|
| draft with `drift` | warning "Out of date": "The total changes by ±₹X since this bill was made.", "Refresh bill" button, `CauseList` |
| issued with a draft auto note (`getAllBillNotes({ billId })`) | info "Draft debit note +₹X" / "Draft credit note −₹X", causes, Review → `/bill-notes/:id` |
| issued, legacy `pendingAdjustment`, no draft note | info "Pending adjustment ±₹X" |
| `negativeStock` | warning "Stock went below zero": "These items were billed as 0 on these days." + `NegativeStockList` |

The bills list shows an "Out of date" marker on drifted drafts (`BillsPage`).

## Sending a draft (`useBillIssueGate`, `src/hooks/useBillIssueGate.tsx`)

- Out-of-date draft → blocked with `OUT_OF_DATE_MESSAGE` ("This bill is out of date. Refresh it
  before sending, so it shows the right total.") and a Refresh button (`useRefreshBillMutation`).
  A 409 `BILL_PERIOD_EMPTY` on refresh shows its own message (delete the draft).
- Negative stock → confirmation listing the spans, then retries with `acknowledgeNegative: true`.
- The server's 409s (`BILL_OUT_OF_DATE`, `NEGATIVE_STOCK_ACK_REQUIRED`) open the same dialogs.
- Used by `BillDetailPage` and `BillsPage`; render `gate.dialog`.

## Tags

- Bill mutations invalidate `YearClose` (issuing can close a year) and `Dashboard`.
- Gated challan/agreement mutations invalidate `Bill` and `BillNote` on a real write only
  (`gatedTags`).

## Key files

| Path | Role |
|------|------|
| `src/components/BillIntegrity.tsx` | `BillIntegrityNotices`, `NegativeStockList`, `CauseList` |
| `src/hooks/useBillIssueGate.tsx` | Send/issue guard |
| `src/utils/billStatus.ts` | `isIssued`, `canChangeStatus` |
| `src/utils/billMoney.ts` | `effectiveAmount`, `balanceDue`, `signedMoney` |
| `src/api/billApi.ts` | `refreshBill`, status, send, `getBillsPage` |
| `src/pages/BillDetailPage.tsx`, `src/pages/BillsPage.tsx` | Pages |
| `src/components/stock/NegativeStockNotice.tsx`, `src/utils/stock.ts` | Negative stock elsewhere (`stockTone`) |

## Changing it safely

- New place that shows a bill amount → `billMoney.ts`, never `bill.totalAmount`.
- New way to issue a draft → go through `useBillIssueGate`.
- Tests: `BillDetailPage.test.tsx`, `BillsPage.test.tsx`, `api/billIntegrityApi.test.ts`,
  `utils/billStatus.test.ts`, `utils/billMoney.test.ts`, `NegativeStockNotice.test.tsx`.

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/bill-integrity.md`, `bill-snapshot-and-drift.md`
- [notes-ui.md](notes-ui.md), [change-gate-ui.md](change-gate-ui.md)
