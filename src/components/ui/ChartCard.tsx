import type { ReactNode } from 'react';
import type { RangeKey } from '../../types';
import { Card } from './Card';
import { SegmentedControl } from './SegmentedControl';
import { Spinner } from './Spinner';
import styles from './ChartCard.module.css';

export type ChartCardProps = {
  title: string;
  /** One line above the chart, e.g. the latest value or period total. */
  headline?: ReactNode;
  /** Range options shown under the chart; omit for a chart with no range choice. */
  presets?: RangeKey[];
  range?: RangeKey;
  onRangeChange?: (range: RangeKey) => void;
  /** Muted message shown in place of the chart (no data). */
  empty?: string;
  loading?: boolean;
  children: ReactNode;
};

const rangeLabel = (r: RangeKey) => (r === 'ALL' ? 'All' : r);

/** A card around one chart: headline, the chart body, and range presets underneath. */
export function ChartCard({
  title,
  headline,
  presets,
  range,
  onRangeChange,
  empty,
  loading,
  children,
}: ChartCardProps) {
  let body: ReactNode = children;
  if (loading) {
    body = (
      <div className={styles.placeholder}>
        <Spinner message="" />
      </div>
    );
  } else if (empty) {
    body = (
      <div className={styles.placeholder}>
        <p className={styles.empty}>{empty}</p>
      </div>
    );
  }

  return (
    <Card title={title}>
      <div className={styles.stack}>
        {headline && <div className={styles.headline}>{headline}</div>}
        <div className={styles.body}>{body}</div>
        {presets && range && onRangeChange && (
          <div className={styles.presets}>
            <SegmentedControl
              size="sm"
              label="Chart range"
              value={range}
              onChange={onRangeChange}
              options={presets.map(p => ({ value: p, label: rangeLabel(p) }))}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
