import { Button, Card, MeterList, TextLink, type MeterListRow } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { PartyRow } from '../../types';
import { fmtCount } from './dashboardFormat';

/** Top parties by outstanding: pieces on site with damaged or lost (12 months) as a danger segment. */
export function PartiesPanel({ parties }: { parties: PartyRow[] }) {
  const rows: MeterListRow[] = parties.map(p => ({
    key: p.partyId,
    label: <TextLink to={`/parties/${p.partyId}`}>{p.name}</TextLink>,
    detail:
      p.outstanding !== undefined ? (
        <span className="mono">{formatMoney(p.outstanding)}</span>
      ) : undefined,
    segments: [
      { value: p.onSite, tone: 'info', label: 'On site' },
      { value: p.damagedLost, tone: 'danger', label: 'Damaged or lost' },
    ],
    note: (
      <>
        <span className="mono">{fmtCount(p.onSite)}</span> on site
        {p.damagedLost > 0 && (
          <>
            {' · '}
            <span className="mono">{fmtCount(p.damagedLost)}</span> damaged or lost
          </>
        )}
      </>
    ),
  }));
  return (
    <Card
      title="Parties"
      actions={
        <Button variant="ghost" size="sm" to="/parties">
          All parties →
        </Button>
      }
    >
      <MeterList
        aria-label="Parties"
        rows={rows}
        empty="No parties on rent yet"
        legend={[
          { tone: 'info', label: 'On site' },
          { tone: 'danger', label: 'Damaged or lost' },
        ]}
      />
    </Card>
  );
}
