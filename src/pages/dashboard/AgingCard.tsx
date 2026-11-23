import { Card, MeterList, type MeterListRow, type MeterTone } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { Aging, AgingKey } from '../../types';

const BUCKETS: Record<AgingKey, { label: string; tone: MeterTone }> = {
  '0-30': { label: '0–30 days', tone: 'info' },
  '31-60': { label: '31–60 days', tone: 'info' },
  '61-90': { label: '61–90 days', tone: 'warning' },
  '90+': { label: '90+ days', tone: 'danger' },
};

/** Outstanding today split by age, one bar per bucket (share of the total). */
export function AgingCard({ aging }: { aging: Aging }) {
  const { buckets, total, advances } = aging;
  const rows: MeterListRow[] =
    total > 0
      ? buckets.map(b => ({
          key: b.key,
          label: BUCKETS[b.key].label,
          detail: <span className="mono">{formatMoney(b.amount)}</span>,
          segments: [
            { value: b.amount, tone: BUCKETS[b.key].tone, label: BUCKETS[b.key].label },
            { value: Math.max(0, total - b.amount), tone: 'muted', label: 'Other ages' },
          ],
        }))
      : [];
  return (
    <Card
      title="Outstanding by age"
      subtitle={total > 0 ? `${formatMoney(total)} outstanding` : undefined}
    >
      <MeterList
        aria-label="Outstanding by age"
        rows={rows}
        empty="Nothing outstanding"
        footnote={advances > 0 ? `${formatMoney(advances)} in advances not shown` : undefined}
      />
    </Card>
  );
}
