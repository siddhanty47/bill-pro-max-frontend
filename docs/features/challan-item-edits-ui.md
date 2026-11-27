# Editing challan lines (UI)

Backend rules: `bill-pro-max-backend-v2/docs/features/challan-item-edits.md`.

On the challan page, Items tab (`ChallanDetailPage`), each line's row menu has:

- **Change item**: opens a row under the table, "Change <item> to [item picker] [quantity]
  Save / Cancel". The picker hides items already on the challan. Save sends
  `PATCH …/items/:itemId` with `{ quantity, itemId: <new> }` (`updateChallanItem` with
  `newItemId`) through `useChangeGate`, so a billed period asks for a reason first. On success the
  row closes; on an error the server message is alerted and the row stays open.
- **Delete**: only when the challan has more than one line (the last line can be changed, not
  removed).

Opening Change item closes the Add item row and vice versa. Both are hidden while the site is
locked (`useSiteLock`). Quantity stays inline-editable on the row.

Tests: `ChallanDetailPage.test.tsx` ("change it to another item", "already on the challan",
"swap fails").
