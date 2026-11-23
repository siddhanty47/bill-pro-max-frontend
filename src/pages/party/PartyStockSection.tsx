import { lazy, Suspense } from 'react';
import { useGetPartyStockQuery } from '../../api/partyApi';
import { DataTable, ErrorMessage, MeterLegend, Spinner, type Column } from '../../components/ui';
import { DetailSection } from '../../components/DetailPageShell';
import { formatCountCompact } from '../../utils/format';
import type { PartyStockRow } from '../../types';
import type { ScrollBarChart as ScrollBarChartComponent } from '../../components/charts/ScrollBarChart';
import styles from './PartyStockSection.module.css';

// recharts stays out of the main bundle: the chart loads on first render.
const ScrollBarChart = lazy(
  () => import('../../components/charts/ScrollBarChart')
) as unknown as typeof ScrollBarChartComponent;

const TITLE = 'Stock on site';
/** Fewer rows than this read fine as a table alone. */
const CHART_MIN_ROWS = 3;

const count = (n: number) => n.toLocaleString('en-IN');

type TableRow = PartyStockRow & { isTotal?: boolean };

const COLUMNS: Column<TableRow>[] = [
  {
    key: 'code',
    header: 'Code',
    mono: true,
    render: r => (r.isTotal ? <strong>Total</strong> : r.code),
  },
  { key: 'name', header: 'Item', render: r => (r.isTotal ? '' : r.name) },
  {
    key: 'onSite',
    header: 'On site',
    align: 'right',
    mono: true,
    render: r => (r.isTotal ? <strong>{count(r.onSite)}</strong> : count(r.onSite)),
  },
  {
    key: 'damagedLost',
    header: 'Damaged or lost (this year)',
    align: 'right',
    mono: true,
    render: r => (r.isTotal ? <strong>{count(r.damagedLost)}</strong> : count(r.damagedLost)),
  },
];

/** What this party holds at its sites now, and what it damaged or lost this year. */
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
    const total: TableRow = {
      itemId: '__total',
      code: '',
      name: '',
      unit: '',
      onSite: data.reduce((s, r) => s + r.onSite, 0),
      damagedLost: data.reduce((s, r) => s + r.damagedLost, 0),
      isTotal: true,
    };
    const summary = `${count(data.length)} items, ${count(total.onSite)} pieces on site`;
    body = (
      <>
        {data.length >= CHART_MIN_ROWS && (
          <div className={styles.chart}>
            <MeterLegend
              items={[
                { tone: 'info', label: 'On site' },
                { tone: 'danger', label: 'Damaged or lost this year' },
              ]}
            />
            <Suspense fallback={<Spinner message="" />}>
              <ScrollBarChart<PartyStockRow>
                data={data}
                xKey="code"
                nameKey="name"
                stacks={[
                  { key: 'onSite', label: 'On site', tone: 'info' },
                  { key: 'damagedLost', label: 'Damaged or lost this year', tone: 'danger' },
                ]}
                format={formatCountCompact}
                tooltip={r => ({
                  title: r.code ? `${r.name} (${r.code})` : r.name,
                  rows: [
                    { label: 'On site', value: count(r.onSite) },
                    { label: 'Damaged or lost this year', value: count(r.damagedLost) },
                    { label: 'Unit', value: r.unit },
                  ],
                })}
                title={TITLE}
                ariaLabel={`${TITLE}: ${summary}`}
              />
            </Suspense>
          </div>
        )}
        <DataTable<TableRow>
          aria-label={TITLE}
          columns={COLUMNS}
          rows={[...data, total]}
          rowKey={r => r.itemId}
          pageSize={data.length + 1}
          mobile={{
            title: r => (r.isTotal ? 'Total' : r.name),
            subtitle: r => (r.isTotal ? undefined : r.code),
            meta: r => [
              <span key="on" className="mono">
                On site {count(r.onSite)}
              </span>,
              <span key="dl" className="mono">
                Damaged or lost {count(r.damagedLost)}
              </span>,
            ],
          }}
        />
      </>
    );
  }

  return (
    <DetailSection title={TITLE} padded={false}>
      {body}
    </DetailSection>
  );
}
