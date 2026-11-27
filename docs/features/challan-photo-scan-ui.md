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

## Tests

`ChallanForm.test.tsx` → `scan from photo`: which input each button opens, camera upload, applied
data and review, unmatched cartage, API error, over-5MB rejection.
