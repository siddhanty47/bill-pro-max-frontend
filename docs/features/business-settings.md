# Business settings (`/business`)

`pages/BusinessDetailPage.tsx`: every field edits inline (`DetailField editable`). Top-level
fields PATCH only themselves; settings PATCH `{ settings: { <key> } }` alone (the backend merges).

## Sections

- **Contact and address:** name, address, phone, email, GST, **PAN**, state code. PAN is
  validated in the browser (`^[A-Z]{5}\d{4}[A-Z]$`, upper-cased, empty clears it; "PAN looks like
  ABCDE1234F"); when empty, documents read it from the GSTIN.
- **Business settings:** billing cycle, currency, default SGST/CGST/IGST, payment due days,
  credit-note deadline (see `year-close-ui.md`).
- **Documents (PDF):** what invoices, notes and challans print (backend
  `docs/features/pdf-documents.md`):
  - Invoice terms (textarea, one per line; invoices and credit/debit notes)
  - Challan terms (textarea, one per line; delivery and return challans)
  - Signatory name, signatory title (empty title prints "Authorised Signatory")
  Values are saved trimmed.

## Tests

`BusinessDetailPage.test.tsx`.
