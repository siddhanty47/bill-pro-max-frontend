# Bulk actions

Multi-select and bulk actions on list pages. Everything runs over the existing single-item
endpoints from the browser; there is no bulk endpoint on the backend.

## Rules

- Selection covers the **visible page only**. Changing page, filter, search or business clears it.
  Prev/Next on a record opened from the table still steps through the whole filtered list.
- A bulk run calls the single-item endpoint per row through `runBulk` (concurrency 3; PDF downloads
  2 at a time). Rows that can't take the action are **skipped**, never sent.
- Every run ends with a "Done" dialog (`BulkResultDialog`) listing what was skipped and why, in table
  order. Skipped and failed rows stay selected; done rows are deselected.
- Confirms and messages use kit dialogs (`BulkConfirmDialog`, `useConfirm`, `MessageDialog`), never
  `window.confirm` / `alert`.
- A second click while a run is going is ignored (`useInFlightGuard`).

## Per list

| List | Actions | Skips |
|------|---------|-------|
| Bills (`pages/bills/useBillBulkActions.tsx`) | Mark as sent, Send to client, Download PDFs, Delete | not a draft, out of date, no email, issued (delete); negative stock gets one combined confirm that retries with `acknowledgeNegative` |
| Challans (`pages/challans/useChallanBulkActions.tsx`) | Confirm, Download PDFs | not a draft; dry run first and any challan that touches bills or stock is skipped as "needs a check, open it to confirm" (the change dialog never opens); closed year |
| Credit/debit notes (`pages/billNotes/useBillNoteBulkActions.tsx`, `/bill-notes` only) | Issue, Cancel, Download PDFs | not a draft, credit-note deadline passed, out of date |
| Payments | Export to CSV | — |
| Parties, Inventory | Export to CSV, Delete (`useBulkDelete`) | server refusal shown as the skip reason; rented items "out on rent" (`pages/inventory/bulkReasons.ts`) |

No bulk delete for challans or payments: the backend has no delete endpoint for them.

## Building blocks (`src/components/bulk/`, import from `components/bulk`)

- `useBulkSelection`: selection set, `resetKey` clearing, `DataTable selection` prop, the phone-only
  "Select all on this page" button.
- `useBulkOutcome`: running flag, in-flight guard, `finish` (skips in run order), the "Done" dialog,
  `runDownloads`.
- `bulkRun.ts`: `plural`, `splitResults`, `downloadPdfs`.
- `BulkResultDialog`, `BulkConfirmDialog`, `useConfirm`, `MessageDialog`, `useInFlightGuard`,
  `useBulkDelete`, `ExportCsvButton`.
- Kit `BulkActionBar` (`components/ui`): "N selected", actions, Clear. Sticky on desktop, a fixed
  bottom bar on phones; its spacer follows the bar's measured height so it never covers the last row.
- Client-paged tables hold the page with `useListPage` and pass `DataTable page` / `onPageChange`.

## CSV (`src/utils/csv.ts`)

`toCsv`, `csvDate`, `csvFileName`, `downloadCsv`. RFC 4180 quoting, CRLF, UTF-8 BOM. Money as plain
numbers. Values starting with `= + - @ \t \r` get a leading `'` (formula injection), except phone
numbers like `+91 98765 43210`. `csvDate` keeps a stored calendar day on its date in every timezone.

## Adding bulk actions to a new list

`useBulkSelection` + kit `BulkActionBar` + `useBulkOutcome` + `runBulk`. On a client-paged table hold
the page (`useListPage`, `DataTable page`/`onPageChange`), give `useBulkSelection` only the visible
page's rows and put the page in `resetKey`.

## Tests

Each hook and page has tests next to it (`*.test.ts(x)`), with MSW for the endpoints.
