import styles from './TrendLabel.module.css';

export type TrendDirection = 'up' | 'down';

export type TrendLabelProps = {
  direction: TrendDirection;
  /** The change without the arrow, e.g. "12% vs last month". */
  children: string;
};

/**
 * A change with a ▲/▼ arrow, e.g. in a StatCard `note` or a ChartCard `headline`. The arrow is
 * hidden from screen readers, which read "up"/"down" instead.
 */
export function TrendLabel({ direction, children }: TrendLabelProps) {
  return (
    <span>
      <span aria-hidden="true">{direction === 'up' ? '▲ ' : '▼ '}</span>
      <span className={styles.hidden}>{direction} </span>
      {children}
    </span>
  );
}
