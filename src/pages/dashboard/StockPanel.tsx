import { Button, MeterLegend } from '../../components/ui';
import { formatCountCompact } from '../../utils/format';
import type { StockRow } from '../../types';
import { LazyChartCard, ScrollBarChart } from './DashboardCharts';
import { chartLabel, fmtCount } from './dashboardFormat';

const TITLE = 'Stock';

/** Every item as a bar: pieces at sites stacked on pieces in the yard; scrolls sideways. */
export function StockPanel({ stock }: { stock: StockRow[] }) {
  const atSites = stock.reduce((s, r) => s + r.atSites, 0);
  const summary =
    stock.length > 0
      ? `${fmtCount(stock.length)} ${stock.length === 1 ? 'item' : 'items'}, ${fmtCount(atSites)} pieces at sites`
      : undefined;
  return (
    <LazyChartCard
      title={TITLE}
      headline={
        stock.length > 0 ? (
          <MeterLegend
            items={[
              { tone: 'accent', label: 'At sites' },
              { tone: 'muted', label: 'In yard' },
            ]}
          />
        ) : undefined
      }
      actions={
        <Button variant="ghost" size="sm" to="/inventory">
          All stock →
        </Button>
      }
      empty={stock.length === 0 ? 'No stock yet' : undefined}
    >
      <ScrollBarChart<StockRow>
        data={stock}
        xKey="code"
        nameKey="name"
        stacks={[
          { key: 'atSites', label: 'At sites', tone: 'accent' },
          { key: 'inYard', label: 'In yard', tone: 'muted' },
        ]}
        format={formatCountCompact}
        tooltip={s => ({
          title: s.code ? `${s.name} (${s.code})` : s.name,
          rows: [
            { label: 'At sites', value: fmtCount(s.atSites) },
            { label: 'In yard', value: fmtCount(s.inYard) },
            { label: 'Total', value: fmtCount(s.atSites + s.inYard) },
            ...(s.damagedLost > 0
              ? [{ label: 'Damaged or lost this year', value: fmtCount(s.damagedLost) }]
              : []),
          ],
        })}
        title={TITLE}
        ariaLabel={chartLabel(TITLE, summary)}
      />
    </LazyChartCard>
  );
}
