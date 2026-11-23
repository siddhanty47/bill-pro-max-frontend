import { cloneElement, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';
import styles from './Chart.module.css';

export type ChartSize = { width: number; height: number };

/**
 * Sizes a chart to its wrapper (fixed token-based height in CSS). `size` forces fixed
 * dimensions instead, which is how tests render a chart (jsdom has no layout).
 */
export function ChartFrame({
  size,
  children,
}: {
  size?: ChartSize;
  children: ReactElement<Partial<ChartSize>>;
}) {
  return (
    <div className={styles.frame}>
      {size ? (
        cloneElement(children, size)
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
