import type { DashboardSummary } from '../../types';
import { AgingCard } from './AgingCard';
import { BillingChart, SteelChart, UtilizationChart } from './DashboardCharts';
import { KpiTiles } from './KpiTiles';
import { PartiesPanel } from './PartiesPanel';
import { StockPanel } from './StockPanel';
import styles from './Dashboard.module.css';

/**
 * Tiles, charts and panels. A section shows only when the summary has its key (the role can
 * read its source); the billing and utilization series are not requested otherwise.
 */
export function DashboardInsights({
  businessId,
  summary,
}: {
  businessId: string;
  summary: DashboardSummary;
}) {
  const showBilling = Boolean(summary.billedThisMonth && summary.collectedThisMonth);
  const showUtilization = summary.onRentPct !== undefined;
  const hasMain = showBilling || showUtilization;
  return (
    <div className={styles.sections}>
      <KpiTiles summary={summary} />
      <div className={[styles.charts, hasMain ? '' : styles.chartsSingle].join(' ')}>
        {hasMain && (
          <div className={styles.column}>
            {showBilling && <BillingChart businessId={businessId} />}
            {showUtilization && <UtilizationChart businessId={businessId} />}
          </div>
        )}
        <div className={styles.column}>
          {summary.aging && <AgingCard aging={summary.aging} />}
          <SteelChart businessId={businessId} />
        </div>
      </div>
      {summary.stock && <StockPanel stock={summary.stock} />}
      {summary.parties && <PartiesPanel parties={summary.parties} />}
    </div>
  );
}
