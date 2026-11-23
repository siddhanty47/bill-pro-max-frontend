import type { Bucket } from '../../types';
import { formatTooltipDate } from './chartFormat';
import styles from './Chart.module.css';

type Entry = { dataKey?: unknown; name?: string | number; value?: unknown; color?: string };

export type ChartTooltipProps = {
  active?: boolean;
  label?: unknown;
  payload?: readonly Entry[];
  bucket: Bucket;
  format: (n: number) => string;
};

/** Hover card: full date, then one formatted value per series. */
export function ChartTooltip({ active, label, payload, bucket, format }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{formatTooltipDate(String(label), bucket)}</p>
      <ul className={styles.tooltipList}>
        {payload.map(p => (
          <li key={String(p.dataKey)} className={styles.tooltipRow}>
            <span className={styles.tooltipName}>{p.name}</span>
            <span className="mono">{format(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
