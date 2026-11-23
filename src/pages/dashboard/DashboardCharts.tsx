import { lazy, Suspense, type ReactNode } from 'react';
import { ChartCard, type ChartCardProps } from '../../components/ui';
import { useGetDashboardSeriesQuery } from '../../api/dashboardApi';
import { useRangePreset } from '../../hooks/useRangePreset';
import { formatMoney, formatMoneyCompact } from '../../utils/format';
import type { DashboardMetric, RangeKey, SeriesPoint } from '../../types';
import { clampPct, steelHeadline } from './dashboardFormat';

// recharts stays out of the main bundle: the chart bodies load on first render.
const BarLineChart = lazy(() => import('../../components/charts/BarLineChart'));
const LineChart = lazy(() => import('../../components/charts/LineChart'));

const BILLING_PRESETS: RangeKey[] = ['3M', '6M', '1Y', '3Y', 'ALL'];
const UTILIZATION_PRESETS: RangeKey[] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];
const STEEL_PRESETS: RangeKey[] = ['1Y', '3Y', 'ALL'];

const NO_DATA = 'No data yet';
const NOT_AVAILABLE = 'Not available';

const num = (p: SeriesPoint, key: string): number => Number(p[key]) || 0;
const pctLabel = (n: number) => `${Math.round(n)}%`;
const indexLabel = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 });

/** One series for the chart's remembered range; `error` covers a 403/500 for that series only. */
function useSeries(
  businessId: string,
  metric: DashboardMetric,
  presets: RangeKey[],
  fallback: RangeKey
) {
  const [range, setRange] = useRangePreset(metric, presets, fallback);
  const { currentData, isError } = useGetDashboardSeriesQuery({ businessId, metric, range });
  return {
    range,
    setRange,
    series: currentData,
    loading: !currentData && !isError,
    error: isError,
  };
}

/** ChartCard whose body is a lazy chart: the card shows its spinner until the chunk arrives. */
function LazyChartCard({
  children,
  ...card
}: Omit<ChartCardProps, 'children'> & { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ChartCard {...card} headline={undefined} empty={undefined} loading>
          {null}
        </ChartCard>
      }
    >
      <ChartCard {...card}>{children}</ChartCard>
    </Suspense>
  );
}

export function BillingChart({ businessId }: { businessId: string }) {
  const { range, setRange, series, loading, error } = useSeries(
    businessId,
    'billing',
    BILLING_PRESETS,
    '1Y'
  );
  const points = series?.points ?? [];
  const billed = points.reduce((s, p) => s + num(p, 'billed'), 0);
  const collected = points.reduce((s, p) => s + num(p, 'collected'), 0);
  const hasData = billed > 0 || collected > 0;
  const share = billed > 0 ? ` (${Math.round((collected / billed) * 100)}%)` : '';
  return (
    <LazyChartCard
      title="Billed vs collected"
      headline={
        hasData
          ? `${formatMoneyCompact(billed)} billed · ${formatMoneyCompact(collected)} collected${share}`
          : undefined
      }
      presets={BILLING_PRESETS}
      range={range}
      onRangeChange={setRange}
      loading={loading}
      empty={error ? NOT_AVAILABLE : hasData ? undefined : NO_DATA}
    >
      {series && (
        <BarLineChart
          data={points}
          bucket={series.bucket}
          bar={{ key: 'billed', label: 'Billed' }}
          line={{ key: 'collected', label: 'Collected' }}
          format={formatMoneyCompact}
          tooltipFormat={formatMoney}
        />
      )}
    </LazyChartCard>
  );
}

export function UtilizationChart({ businessId }: { businessId: string }) {
  const { range, setRange, series, loading, error } = useSeries(
    businessId,
    'utilization',
    UTILIZATION_PRESETS,
    '6M'
  );
  const raw = series?.points ?? [];
  const points = raw.map(p => ({ ...p, pct: clampPct(num(p, 'pct')) }));
  const hasData = raw.some(p => num(p, 'total') > 0 || num(p, 'pct') > 0);
  const avg = points.length ? Math.round(points.reduce((s, p) => s + p.pct, 0) / points.length) : 0;
  return (
    <LazyChartCard
      title="Stock on rent %"
      headline={hasData ? `avg ${avg}% on rent` : undefined}
      presets={UTILIZATION_PRESETS}
      range={range}
      onRangeChange={setRange}
      loading={loading}
      empty={error ? NOT_AVAILABLE : hasData ? undefined : NO_DATA}
    >
      {series && (
        <LineChart
          data={points}
          bucket={series.bucket}
          y={{ key: 'pct', label: 'On rent' }}
          domain={[0, 100]}
          format={pctLabel}
        />
      )}
    </LazyChartCard>
  );
}

export function SteelChart({ businessId }: { businessId: string }) {
  const { range, setRange, series, loading, error } = useSeries(
    businessId,
    'steel',
    STEEL_PRESETS,
    '1Y'
  );
  const points = series?.points ?? [];
  const hasData = !error && points.length > 0;
  return (
    <LazyChartCard
      title="Steel price index"
      subtitle="Govt WPI · mild steel bars & rods · monthly"
      headline={hasData ? steelHeadline(series?.changePct, range) : undefined}
      presets={STEEL_PRESETS}
      range={range}
      onRangeChange={setRange}
      loading={loading}
      empty={hasData || loading ? undefined : 'Steel index not available'}
    >
      {series && (
        <LineChart
          data={points}
          bucket={series.bucket}
          y={{ key: 'index', label: 'Index' }}
          format={indexLabel}
        />
      )}
    </LazyChartCard>
  );
}
