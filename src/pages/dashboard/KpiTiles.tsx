import { StatCard } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { DashboardSummary, Trend } from '../../types';
import { clampPct, fmtCount, monthChange } from './dashboardFormat';
import { ChangeText } from './ChangeText';
import styles from './Dashboard.module.css';

/** StatCard note + tone for a month-on-month trend. */
function trendNote(trend: Trend) {
  const { change, tone } = monthChange(trend);
  return { note: change && <ChangeText change={change} />, noteTone: tone };
}

/**
 * The KPI row; a tile is left out when its summary key is absent (the role can't read it).
 * Order: money (billed, collected, rent per day), the stock pair, then days to pay. On a
 * phone money and days-to-pay tiles take a full row and the pair shares one.
 */
export function KpiTiles({ summary }: { summary: DashboardSummary }) {
  const { billedThisMonth, collectedThisMonth, avgDaysToPay, onRentPct, activeSites, rentPerDay } =
    summary;
  return (
    <div className={styles.tiles}>
      {billedThisMonth && (
        <StatCard
          label="Billed this month"
          value={formatMoney(billedThisMonth.value)}
          {...trendNote(billedThisMonth)}
        />
      )}
      {collectedThisMonth && (
        <StatCard
          label="Collected this month"
          value={formatMoney(collectedThisMonth.value)}
          {...trendNote(collectedThisMonth)}
        />
      )}
      {rentPerDay !== undefined && (
        <StatCard label="Rent per day" value={formatMoney(rentPerDay)} />
      )}
      {onRentPct !== undefined && (
        <StatCard
          className={styles.pairTile}
          label="Stock on rent"
          value={`${Math.round(clampPct(onRentPct))}%`}
        />
      )}
      {activeSites !== undefined && (
        <StatCard className={styles.pairTile} label="Active sites" value={fmtCount(activeSites)} />
      )}
      {avgDaysToPay !== undefined &&
        (avgDaysToPay === null ? (
          <StatCard label="Avg days to get paid" note="Not enough data" />
        ) : (
          <StatCard label="Avg days to get paid" value={fmtCount(Math.round(avgDaysToPay))} />
        ))}
    </div>
  );
}
