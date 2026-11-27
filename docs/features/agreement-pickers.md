# Agreement pickers

Every place a user picks an agreement labels it by **site**, not by agreement id. Agreement ids
(`HRIN_BISRAKH_1795168405081`) are internal and hide the site among digits.

| Where | Label |
|---|---|
| `ChallanForm` agreement select | `CODE — full site address (from <start date>)` |
| `BillForm` agreement select | `CODE — full site address (<billing cycle>[, until <end date>])` |
| `BulkBillForm` agreement checkboxes | `Party · CODE — address` first; end date; agreement id last, small and muted |

- The label comes from `siteLabel(siteCode, party.sites)` in `src/utils/sites.ts`. When the party
  has no matching site (or it has no address) the label falls back to the bare site code.
- The option **value** stays the `agreementId`; only the text changed.
- Two agreements on one site (a rate change) differ by their dates in the suffix.
