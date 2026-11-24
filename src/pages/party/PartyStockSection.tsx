import { lazy, Suspense } from 'react';
import { useGetPartyStockQuery } from '../../api/partyApi';
import { DataTable, ErrorMessage, MeterLegend, Spinner, type Column } from '../../components/ui';
import { DetailSection } from '../../components/DetailPageShell';
import { formatCountCompact } from '../../utils/format';
import type { PartyStockRow } from '../../types';
import type { ScrollBarChart as ScrollBarChartComponent } from '../../components/charts/ScrollBarChart';
import styles from './PartyStockSection.module.css';
import { NegativeStockNotice } from '../../components/stock/NegativeStockNotice';
import { stockTone } from '../../utils/stock';

// recharts stays out of the main bundle: the chart loads on first render.
const ScrollBarChart = lazy(
  () => import('../../components/charts/ScrollBarChart')
) as unknown as typeof ScrollBarChartComponent;

const TITLE = 'Stock on site';
/** Fewer rows than this read fine as a table alone. */
const CHART_MIN_ROWS = 3;

const count = (n: number) => n.toLocaleString('en-IN');
const LOST = 'Damaged or lost in the last 12 months';

const COLUMNS: Column<PartyStockRow>[] = [
  { key: 'code', header: 'Code', mono: true },
  { key: 'name', header: 'Item' },
  {
    key: 'onSite',
    header: 'On site',
    align: 'right',
    mono: true,
    render: r => count(r.onSite),
    tone: r => stockTone(r.onSite),
  },
  {
    key: 'damagedLost',
    header: LOST,
    align: 'right',
    mono: true,
    render: r => count(r.damagedLost),
  },
];

/** A row with its bar height: a negative count draws no bar (the table and tooltip show it). */
type ChartRow = PartyStockRow & { onSiteBar: number };

/** What this party holds at its sites now, and what it damaged or lost in the last 12 months. */
export function PartyStockSection({
  businessId,
  partyId,
}: {
  businessId: string;
  partyId: string;
}) {
  const { data, error, isLoading, refetch } = useGetPartyStockQuery(
    { businessId, partyId },
    { skip: !businessId || !partyId }
  );

  // No party read: the section is simply not offered.
  if (error && 'status' in error && error.status === 403) return null;

  let body;
  if (isLoading) {
    body = (
      <div className={styles.pad}>
        <Spinner message="Loading stock…" />
      </div>
    );
  } else if (error) {
    body = (
      <div className={styles.pad}>
        <ErrorMessage error={error} onRetry={refetch} />
      </div>
    );
  } else if (!data || data.length === 0) {
    body = (
      <div className={styles.pad}>
        <p className={styles.empty}>Nothing on site</p>
      </div>
    );
  } else {
    const total = {
      onSite: data.reduce((s, r) => s + r.onSite, 0),
      damagedLost: data.reduce((s, r) => s + r.damagedLost, 0),
    };
    const summary = `${count(data.length)} items, ${count(total.onSite)} pieces on site`;
    const chartRows: ChartRow[] = data.map(r => ({ ...r, onSiteBar: Math.max(0, r.onSite) }));
    body = (
      <>
        <NegativeStockNotice quantities={data.map(r => r.onSite)} className={styles.notice} />
        {data.length >= CHART_MIN_ROWS && (
          <div className={styles.chart}>
            <MeterLegend
              items={[
                { tone: 'accent', label: 'On site' },
                { tone: 'danger', label: LOST },
              ]}
            />
            <Suspense fallback={<Spinner message="" />}>
              <ScrollBarChart<ChartRow>
                data={chartRows}
                xKey="code"
                nameKey="name"
                stacks={[
                  { key: 'onSiteBar', label: 'On site', tone: 'accent' },
                  { key: 'damagedLost', label: LOST, tone: 'danger' },
                ]}
                format={formatCountCompact}
                tooltip={r => ({
                  title: r.code ? `${r.name} (${r.code})` : r.name,
                  rows: [
                    { label: 'On site', value: count(r.onSite) },
                    { label: LOST, value: count(r.damagedLost) },
                    { label: 'Unit', value: r.unit },
                  ],
                })}
                title={TITLE}
                ariaLabel={`${TITLE}: ${summary}`}
              />
            </Suspense>
          </div>
        )}
        <DataTable<PartyStockRow>
          aria-label={TITLE}
          columns={COLUMNS}
          rows={data}
          rowKey={r => r.itemId}
          pageSize={data.length}
          mobile={{
            title: r => r.name,
            subtitle: r => r.code,
            meta: r => [
              <span key="on">
                On site <span className="mono">{count(r.onSite)}</span>
              </span>,
              <span key="dl">
                {LOST} <span className="mono">{count(r.damagedLost)}</span>
              </span>,
            ],
          }}
        />
        <div className={styles.total}>
          <span className={styles.totalLabel}>Total</span>
          <MeterLegend
            items={[
              { tone: 'accent', label: 'On site', value: total.onSite },
              { tone: 'danger', label: LOST, value: total.damagedLost },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <DetailSection title={TITLE} padded={false}>
      {body}
    </DetailSection>
  );
}
