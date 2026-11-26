# Credit/debit notes UI

Issued bills are corrected only by notes. The UI lists notes, lets users write manual notes, review
auto notes drafted by the backend, issue, cancel and email them, and shows every bill's effective
amount.

## Pages and components

| Where | What |
|-------|------|
| `/bill-notes` (`BillNotesPage`) | All notes; filters; text search runs in the browser over `getAllBillNotes` (the endpoint has no text search) |
| `/bill-notes/:noteId` (`BillNoteDetailPage`) | Note detail, lines, totals, change history. Draft: edit (manual: lines + reason; auto/full-value: reason only), Issue (confirm), Cancel. Issued: send email, PDF |
| Bill page, issued bills | "Credit/debit notes" tab; "New credit note" / "New debit note" (`BillNoteForm mode="create"`; credit can send `fullValue`) |
| Party page | "Credit/debit notes" tab |
| Portal (`SharedPortalPage`) | Bills tab lists issued notes with a PDF per row (`shareLinkApi.getPortalNotes`, `downloadPortalNotePdf`) |
| `components/billing/BillNotesTable` | The only notes table (`showBill`, `partyName` toggle columns) |
| `components/forms/BillNoteForm` | Reason + manual line editor; tax preview from the bill's own rates (`manualNoteTotals`); an edit sends `lines` only when they changed |

Sidebar shows a "draft" count from nav counts `draftNotes`.

## Rules

- Every note amount and bill notes total uses `signedMoney` (+ debit, − credit; a note's discount
  reads as −). `noteSign(type)` gives the sign.
- Labels (`NOTE_TYPE_LABEL`, `NOTE_SOURCE_LABEL`, line kinds) and PDF name `noteFileName` live in
  `src/utils/billNoteLabels.ts`.
- Credit-note deadline: bill page disables "New credit note" and note page disables Issue on a
  credit, both with `creditClosedMessage(...)` ("Credit notes for FY … closed on …"); server 409
  `CREDIT_NOTE_DEADLINE_PASSED` is shown as its message. Debits have no limit. See
  [year-close-ui.md](year-close-ui.md).
- 409 `NOTE_OUT_OF_DATE` on issue means the auto draft was re-derived; refetch and review again.
- PDFs: `queryFn` + `downloadFile(url, fileName, baseQuery)` (`src/api/downloadFile.ts`), saved by
  `utils/download.ts` `saveBlob`; data is `null`, no Blob in the store; callers pass `fileName`.

## API (`src/api/billNoteApi.ts`)

`getBillNotes` (paged), `getAllBillNotes` (whole list by `partyId`/`billId`/status/type/source),
`getBillNote`, `createBillNote`, `updateBillNote`, `issueBillNote`, `cancelBillNote`,
`sendBillNote`, `downloadBillNotePdf` (lazy). Mutations invalidate `BillNote`, `Bill`, `AuditLog`,
`Dashboard` (`NOTE_MUTATION_TAGS`; per-note ids on edit/issue/cancel).

## Key files

| Path | Role |
|------|------|
| `src/api/billNoteApi.ts` | Endpoints |
| `src/pages/BillNotesPage.tsx`, `BillNoteDetailPage.tsx` | Pages |
| `src/components/billing/BillNotesTable.tsx` | Shared table |
| `src/components/forms/BillNoteForm.tsx` | Create/edit form |
| `src/utils/billMoney.ts`, `src/utils/billNoteLabels.ts` | Money and labels |
| `src/components/statements/BillsPreview.tsx` | Notes + Effective columns when a bill has notes |

## Changing it safely

- Never copy the notes table; extend `BillNotesTable`.
- `BillNote`, `BillNoteLine` types mirror backend `models/BillNote.ts`.
- Tests: `BillNotesPage.test.tsx`, `BillNoteDetailPage.test.tsx`, `BillNoteForm.test.tsx`,
  `api/billNoteApi.test.ts`, `utils/billMoney.test.ts`, `BillsPreview.test.tsx`.

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/credit-debit-notes.md`
- [bill-integrity-ui.md](bill-integrity-ui.md)
