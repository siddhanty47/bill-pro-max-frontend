import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { formatMoney, formatMoneyCompact } from '../../utils/format';
import type { PartyRow } from '../../types';
import { LazyChartCard, ScrollBarChart } from './DashboardCharts';
import { chartLabel, fmtCount } from './dashboardFormat';

const TITLE = 'Outstanding by party';

/** Every party that owes money as a bar, highest first; a bar opens the party. */
export function PartiesPanel({ parties }: { parties: PartyRow[] }) {
  const navigate = useNavigate();
  const total = parties.reduce((s, p) => s + p.outstanding, 0);
  const summary =
    parties.length > 0
      ? `${fmtCount(parties.length)} ${parties.length === 1 ? 'party' : 'parties'}, ${formatMoneyCompact(total)}`
      : undefined;
  return (
    <LazyChartCard
      title={TITLE}
      subtitle="Parties that owe you, highest first"
      actions={
        <Button variant="ghost" size="sm" to="/parties">
          All parties →
        </Button>
      }
      empty={parties.length === 0 ? 'Nobody owes you money' : undefined}
    >
      <ScrollBarChart<PartyRow>
        data={parties}
        xKey="code"
        nameKey="name"
        stacks={[{ key: 'outstanding', label: 'Outstanding', tone: 'info' }]}
        format={formatMoneyCompact}
        tooltip={p => ({
          title: p.code ? `${p.name} (${p.code})` : p.name,
          rows: [{ label: 'Outstanding', value: formatMoney(p.outstanding) }],
          hint: 'Open party →',
        })}
        onBarClick={p => navigate(`/parties/${p.partyId}`)}
        ariaLabel={chartLabel(TITLE, summary)}
      />
    </LazyChartCard>
  );
}
