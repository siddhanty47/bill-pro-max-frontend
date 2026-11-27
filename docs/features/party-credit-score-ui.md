# Party credit score UI

"Credit score" section on the party page (About tab, above "Stock on site"):
`src/pages/party/PartyCreditScoreSection.tsx`. Backend rules and the maths:
`bill-pro-max-backend-v2/docs/features/party-credit-score.md`.

## What it shows

- Score `76/100` and a band chip: Good (success), Moderate (info), Bad (warning), Worst (danger).
- One line on how it is worked out: "Based on what is unpaid now (60%) and bills paid in the last
  12 months (40%)."
- "Unpaid now ₹X" with a stacked kit `Meter` of the four age buckets and a `MeterLegend`
  ("0–30 days past due · ₹… · 45%"); tones accent / info / warning / danger. "Nothing unpaid." when
  the party owes nothing.
- Paid history: "N bills paid in the last 12 months, X days late on average." (or "on time on
  average", or "No bills paid in the last 12 months.").
- No score (nothing unpaid, no history): "Not enough data yet" + why.
- A 403 (no party or bill read, e.g. client portal) hides the section.

## API

`partyApi.getPartyCreditScore` → `GET /businesses/:id/parties/:partyId/credit-score`
(`PartyCreditScore` in `src/types/index.ts`). Provides `Party` (that id), `Bill`, `Payment`,
`BillNote` tags, so bill, payment and note mutations refresh it.

## Tests

`PartyCreditScoreSection.test.tsx`; default MSW handler (no score) in `src/test/msw/handlers.ts`.
