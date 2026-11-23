import { StatCard } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { DashboardSummary } from '../../types';
import { clampPct, fmtCount, trendNote } from './dashboardFormat';
import styles from './Dashboard.module.css';

/** The KPI row; a tile is left out when its summary key is absent (the role can't read it). */
export function KpiTiles({ summary }: { summary: DashboardSummary }) {
  const { billedThisMonth, collectedThisMonth, avgDaysToPay, onRentPct, activeSites, rentPerDay } =
    summary;
  return (
    <div className={styles.tiles}>
      {billedThisMonth && (
        <StatCard
          className={styles.moneyTile}
          label="Billed this month"
          value={formatMoney(billedThisMonth.value)}
          {...trendNote(billedThisMonth)}
        />
      )}
      {collectedThisMonth && (
        <StatCard
          className={styles.moneyTile}
          label="Collected this month"
          value={formatMoney(collectedThisMonth.value)}
          {...trendNote(collectedThisMonth)}
        />
      )}
      {avgDaysToPay !== undefined &&
        (avgDaysToPay === null ? (
          <StatCard label="Avg days to get paid" note="Not enough data" />
        ) : (
          <StatCard label="Avg days to get paid" value={fmtCount(Math.round(avgDaysToPay))} />
        ))}
      {onRentPct !== undefined && (
        <StatCard label="Stock on rent" value={`${Math.round(clampPct(onRentPct))}%`} />
      )}
      {activeSites !== undefined && <StatCard label="Active sites" value={fmtCount(activeSites)} />}
      {rentPerDay !== undefined && (
        <StatCard
          className={styles.moneyTile}
          label="Rent per day"
          value={formatMoney(rentPerDay)}
        />
      )}
    </div>
  );
}
