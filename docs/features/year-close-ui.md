# Year close UI

Shows which financial years are closed per site, makes challan and agreement screens read only for
days in a closed year, and enforces the credit-note deadline in the UI. The backend derives all of
it; the UI only reads and mirrors the date rules.

## Rules

- FY = 1 April – 31 March, label `2025-26`. Calendar days are IST dates stored as UTC midnight;
  never use local-time FY math. Helpers in `src/utils/financialYear.ts`: `fyOf`, `fyEnd`,
  `fyHasEnded`, `recentFys` (current FY + the five before it), `isOnOrBeforeDay`,
  `effectiveEndDate`, `closedYearMessage`, credit-deadline helpers.
- `effectiveEndDate` mirrors the backend: an end date counts only once the agreement is closed
  (`nextAgreementId` set or status ≠ `active`).
- Site lock: `useSiteLock(businessId, partyId, agreementId)` (`src/hooks/useSiteLock.ts`) wraps
  `getSiteClosedThrough`; `isLocked(day)` = day on or before `lockedThrough`; `message` =
  `closedYearMessage`. While loading or on error it reads as unlocked (the server still refuses).
- Used in `ChallanDetailPage` (read only + notice when the challan date is locked),
  `AgreementDetailPage` (start, opening stock, end/extend locks via `effectiveEndDate` + 1 day) and
  `ChallanForm` (date field error; submit blocked).
- A 409 `YEAR_CLOSED` or dry run `blocked: 'closedYear'` shows the closed-year mode of
  `ChangeImpactDialog` (see [change-gate-ui.md](change-gate-ui.md)).

## `/year-close` page (`src/pages/YearClosePage.tsx`)

- Sidebar "Year close" (icon `lock`, Business group); route in `App.tsx`.
- FY select over `recentFys(today)`, default the previous FY (`fys[1]`). Uses `currentData` so the
  old FY's rows never show while the new one loads.
- One row per site: party, site, last billable day, status chip, closing bill link.
  Chips: Closed (success), Locked (neutral, `lockedByLaterYear`: "Locked by FY <later> close"),
  Open (warning, FY ended, not closed: says which bill closes it), Running (info, FY not ended).

## Credit-note deadline

- `business.settings.creditNoteDeadline` (`MM-DD`, default `11-30`), edited on `/business`,
  validated by `creditNoteDeadlineSchema` (same regex and non-leap calendar check as the backend).
- Business settings PATCH sends only the changed setting.
- `creditClosedMessage(periodEnd, setting, today)`: when today (IST) is past the deadline of
  `fyOf(billingPeriod.end)`, bill page disables "New credit note" and note page disables Issue on
  credits, both showing the message. Debit notes have no limit.

## API (`src/api/yearCloseApi.ts`)

| Hook | Route | Tag |
|------|-------|-----|
| `useGetYearStatusQuery({ businessId, fy })` | `GET /year-close?fy=` | provides `YearClose` |
| `useGetSiteClosedThroughQuery({ businessId, partyId, agreementId })` | `GET /year-close/site` → `closedThrough` | provides `YearClose` |

`YearClose` is invalidated by bill, payment and business mutations.

## Changing it safely

- Change FY/deadline/effective-end rules on both sides together (backend `src/billing/yearClose.ts`,
  `agreementPeriod.ts`).
- Tests: `utils/financialYear.test.ts`, `pages/YearClosePage.test.tsx`, `api/yearCloseApi.test.ts`,
  `ChallanDetailPage.test.tsx`, `AgreementDetailPage.test.tsx`, `ChallanForm.test.tsx`.

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/year-close.md`
- [notes-ui.md](notes-ui.md)
