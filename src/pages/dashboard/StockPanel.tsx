import { Button, Card, MeterList, type MeterListRow } from '../../components/ui';
import type { StockRow } from '../../types';
import { fmtCount } from './dashboardFormat';

/** Top items by pieces at sites: at sites / in yard bar, damaged or lost (12 months) as text. */
export function StockPanel({ stock }: { stock: StockRow[] }) {
  const rows: MeterListRow[] = stock.map(s => ({
    key: s.itemId,
    label: s.name,
    detail: (
      <>
        <span className="mono">{fmtCount(s.atSites)}</span> at sites /{' '}
        <span className="mono">{fmtCount(s.atSites + s.inYard)}</span>
      </>
    ),
    segments: [
      { value: s.atSites, tone: 'accent', label: 'At sites' },
      { value: s.inYard, tone: 'muted', label: 'In yard' },
    ],
    note:
      s.damagedLost > 0 ? (
        <>
          <span className="mono">{fmtCount(s.damagedLost)}</span> damaged or lost this year
        </>
      ) : undefined,
  }));
  return (
    <Card
      title="Stock"
      actions={
        <Button variant="ghost" size="sm" to="/inventory">
          All stock →
        </Button>
      }
    >
      <MeterList
        aria-label="Stock"
        rows={rows}
        empty="No stock yet"
        legend={[
          { tone: 'accent', label: 'At sites' },
          { tone: 'muted', label: 'In yard' },
        ]}
      />
    </Card>
  );
}
