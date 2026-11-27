# Bill generation UI

Single and bulk bill forms on the Bills page.

## GST (tax mode)

GST follows the site (place of supply): same state as the business → CGST + SGST, another state →
IGST. Business state = `business.stateCode`, else its GSTIN; site state = the site's `stateCode`,
else the party GSTIN.

- **Single bill** (`components/forms/BillForm.tsx`): picks the mode from the chosen agreement's site
  and shows it in the "Tax mode" select; the user can override it, and the form sends `taxMode`.
- **Bulk** (`components/forms/BulkBillForm.tsx`): no tax mode select. It shows SGST, CGST, IGST and
  discount fields (prefilled from business defaults) and sends all three rates **without**
  `taxMode`; the backend derives the mode per agreement (`bill-pro-max-backend-v2/docs/features/gst-tax-mode.md`).
  Each agreement row shows the GST it will get: "CGST + SGST", "IGST", or
  "CGST + SGST (state not set)" when either state is missing.

## Tests

`BillForm.test.tsx`, `BulkBillForm.test.tsx` (payload has no `taxMode` and all three rates; per-row
GST labels).
