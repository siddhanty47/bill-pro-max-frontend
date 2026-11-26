# Change gate UI (impact dialog)

Challan and agreement changes that the backend gates are first sent as a dry run. If nothing billed
or stock is touched the change is saved straight away; otherwise a dialog shows what it affects
and asks for a reason. The server stays the source of truth: if the real save is refused, the same
dialog reopens with the server's answer.

## Flow (`useChangeGate`, `src/hooks/useChangeGate.tsx`)

1. `run(call)` calls `call({ dryRun: true })`.
   - The call throws 409 `YEAR_CLOSED` → closed-year dialog.
   - The response is not a dry-run result (old backend ignored `dryRun`) → treated as saved.
2. `needsDialog(report)`: `affected.length > 0 || negative.length > 0 || blocked !== null`.
   No → commit with no gate fields. Yes → show `ChangeImpactDialog`.
3. Confirm → `call({ reason?, confirmNegative? })`; `confirmNegative: true` is sent when the report
   had negative spans or the server asked for it.
4. A refused save maps back onto the dialog (`reportFromError`): `YEAR_CLOSED` → closed year;
   `BILLED_PERIOD_LOCKED` → `blocked: 'role'`; `REASON_REQUIRED` → reason required;
   `NEGATIVE_STOCK_CONFIRM_REQUIRED` → negative spans from `details.negative`. Any other error
   rejects the `run` promise.
5. `run` resolves `true` when saved, `false` when the user cancelled. Cancel is ignored while a save
   is in flight.

## Dialog (`src/components/billing/ChangeImpactDialog.tsx`)

Plain words for the owner: no "credit/debit note" or "drift" jargon in the dialog.

| Report | Shows |
|--------|-------|
| `blocked: 'closedYear'` | Title "This year is closed", danger notice `closedYearMessage(fy, lockedThrough)` ("FY 2025-26 is closed for this site. Anything dated on or before 31 Mar 2026 can't be changed."), Close button only |
| `blocked: 'role'` | Warning "These months are already billed. Only an owner or manager can make this change."; Close button only, no reason field |
| drafts in `affected` | "Not sent yet (k)": "We'll update these. Check them before sending." + bill rows |
| issued in `affected` | "Already sent to the client (k)": "We won't change a sent bill. We'll prepare a correction with the difference for you to review and send." + bill rows |
| `negative` | "Stock will go below zero" + `NegativeStockList` |

Title: "This change will update N bills" when bills are affected, else "Stock will go below zero",
else "Check this change". Reason field "Why are you making this change?" (required when
`requiresReason`); buttons Cancel / "Save change".

**Bill preview:** clicking a bill row opens `BillPreviewPanel` (`components/billing/`) beside the
dialog (the Modal goes `size="wide"`): period, total, paid, balance, up to 6 items and "Open full
bill" (new tab). Clicking the row again, the panel's close button or Escape closes only the panel;
the typed reason is kept. On phones the panel replaces the dialog body and shows "Back to the change".

## API side (`src/api/changeGate.ts`)

- `withGate(gate, body)` merges `reason` / `confirmNegative` into the body and adds
  `params: { dryRun: 'true' }` for a dry run.
- `unwrapGated<T>` as `transformResponse`; `isDryRunResult` to tell a report from a saved value.
- `gatedTags(tags)` for `invalidatesTags`: a dry run invalidates nothing. Gated tag lists include
  `'BillNote'` (the drift pass re-derives auto notes on a real write) and usually `'Bill'`,
  `'Dashboard'`, `'AuditLog'`.
- Gated endpoints: `challanApi.ts` (8: create, confirm, item update/add/delete, date,
  transportation, damaged items), `agreementApi.ts` (4), `partyApi.ts` (create agreement).
- Call sites using `useChangeGate`: `ChallansPage`, `ChallanDetailPage`, `AgreementDetailPage`,
  `PartyDetailPage`, `PartiesPage`. Render the hook's `dialog` in the page.
- Read error codes with `getApiError` / `hasApiErrorCode` (`src/utils/apiError.ts`), never by
  matching messages.

## Changing it safely

- A new gated backend mutation needs: endpoint with `withGate` + `unwrapGated` + `gatedTags`,
  argument type `& GateArgs`, and its call site wrapped in `gate.run(g => mutate({ ...args, ...g }).unwrap())`.
- Never call a gated mutation directly from a button; the preview is what keeps staff from hitting
  a 403 after typing.
- Types: `GateArgs`, `GateReport`, `GateNegativeSpan`, `DryRunResult` in `src/types/index.ts`
  mirror backend `ChangeGate.ts`.
- Tests: `src/hooks/useChangeGate.test.tsx`, `src/components/billing/ChangeImpactDialog.test.tsx`,
  `src/api/billIntegrityApi.test.ts`, page tests (`ChallanDetailPage`, `AgreementDetailPage`,
  `ChallansPage.create`).

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/change-gate.md`
- [year-close-ui.md](year-close-ui.md), [bill-integrity-ui.md](bill-integrity-ui.md)
