# Dashboard and sidebar counts

The home page shows KPIs, aging, stock, outstanding by party and charts (billing, utilization,
steel price index); the sidebar shows counts. Every backend key is optional: it is absent when the
role cannot read it, and the UI hides that tile.

## Rules

- `src/api/dashboardApi.ts`: `getNavCounts` (`/dashboard/nav-counts`), `getDashboardSummary`
  (`/summary`), `getDashboardSeries` (`/series?metric=&range=`); all provide `Dashboard`.
- `Dashboard` is invalidated by bill, payment, challan, inventory, party, agreement and note
  mutations, and by `useSearchIndexSync` on the `search:index-changed` socket event.
- Sidebar (`Layout.tsx`, `navGroups` item `count`): inventory, parties, agreements, draft challans,
  overdue bills, draft notes; polled every 5 minutes (`NAV_COUNTS_POLL_MS`).
- Charts (`src/components/charts/*`, Recharts) load only via `React.lazy` (`pages/dashboard/DashboardCharts.tsx`)
  so Recharts stays out of the main bundle; colours from tokens via `useChartTheme`.
  `ScrollBarChart` = fixed-width vertical bar per row in a kit `ScrollArea` with a fixed y-axis
  (stock, outstanding by party).
- Chart range presets are remembered per chart in localStorage (`useRangePreset`).
- Party page "Stock on site" (`pages/party/PartyStockSection.tsx`) uses `partyApi.getPartyStock`;
  a 403 hides it. Stock numbers come from the backend; never recompute them; negatives are shown
  with `stockTone`.

## Key files

| Path | Role |
|------|------|
| `src/pages/DashboardPage.tsx` | Page shell, overdue bills table |
| `src/pages/dashboard/*` | `DashboardInsights`, `KpiTiles`, `AgingCard`, `StockPanel`, `PartiesPanel`, `DashboardCharts`, `dashboardFormat` |
| `src/components/charts/*` | `BarLineChart`, `LineChart`, `ScrollBarChart`, `ChartFrame`, `chartTheme` |
| `src/components/ui` | `StatCard`, `Meter*`, `ChartCard`, `ScrollArea`, `NavCount` |
| `src/hooks/useRangePreset.ts` | Range memory |

## Changing it safely

- New summary key: optional in `DashboardSummary` (`src/types/index.ts`, mirrors backend
  `DashboardService.ts`), rendered only when present.
- New mutation that changes dashboard numbers: add `'Dashboard'` to its `invalidatesTags`.
- Keep chart imports lazy.
- Tests: `DashboardPage.test.tsx`, `pages/dashboard/panels.test.tsx`, `components/charts/*.test.tsx`,
  `api/dashboardApi.test.ts`, `Layout.test.tsx`, `PartyStockSection.test.tsx`.

## Related

- Backend: `bill-pro-max-backend-v2/docs/features/dashboard.md`
- [design-system.md](design-system.md)
