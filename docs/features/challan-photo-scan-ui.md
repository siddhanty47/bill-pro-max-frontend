# Challan photo scan (UI)

`components/forms/ChallanForm.tsx` fills the challan form from a photo of a handwritten challan.
Backend: `bill-pro-max-backend-v2/docs/features/challan-photo-scan.md`.

## Buttons

| Button | Input | Opens |
|---|---|---|
| **Take photo** | `#challan-camera`, `accept="image/*"`, `capture="environment"` | the back camera |
| **Scan from photo** | `#challan-photo`, `accept="image/jpeg,image/png,image/webp"` | the gallery / file picker |

- Android Chrome only offers the camera when the input has `capture`; without it the picker opens
  straight to the gallery. iOS shows "Take photo / Photo library" for either input.
- **Take photo** is hidden on devices with a mouse (`@media (hover: hover) and (pointer: fine)`).
- Both inputs share `handlePhotoUpload`: 5MB limit, `POST /challans/extract-from-photo`
  (`useExtractChallanFromPhotoMutation`), then `applyExtractedData` and the `ScanReviewPanel`.

## Applying a scan (`applyExtractedData`)

It returns the result as applied, and that is what `ScanReviewPanel` shows:

- A `partyId` that is not in the business's parties is dropped (review: "Party not matched").
- The agreement is kept only when it is one of that party's agreements. It is selected through
  `pendingAgreementId`: an effect sets it once the party's agreement options have rendered (the old
  `setTimeout(0)` could fire before them and leave the select blank).
- An item id not in the inventory is dropped and the row shows the text read off the challan.
  Matched rows use the inventory name; the backend sends the handwritten text as `readAs`.
- The review's "Matched" row lists `read as → catalog name` for every matched item with `readAs`.

## Tests

`ChallanForm.test.tsx` → `scan from photo`: which input each button opens, camera upload, applied
data and review, unmatched cartage, scanned agreement selected, unknown party/agreement/item
dropped, another party's agreement not selected, API error, over-5MB rejection.
