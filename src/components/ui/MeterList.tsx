import type { ReactNode } from 'react';
import { Meter, MeterLegend, type MeterLegendItem, type MeterSegment } from './Meter';
import styles from './MeterList.module.css';

export type MeterListRow = {
  key: string;
  /** The row's name (text or a `TextLink`). */
  label: ReactNode;
  segments: MeterSegment[];
  /** Right of the label, e.g. an amount (wrap numbers in `.mono`). */
  detail?: ReactNode;
  /** Muted line under the bar. */
  note?: ReactNode;
};

export type MeterListProps = {
  rows: MeterListRow[];
  /** One legend for every bar, above the rows. */
  legend?: MeterLegendItem[];
  /** Muted line shown instead of the rows when there are none. */
  empty?: string;
  /** Muted line after the rows. */
  footnote?: ReactNode;
  /** Names the list. */
  'aria-label'?: string;
};

/** Stacked bars, one per row (stock items, parties, ageing buckets), sharing one legend. */
export function MeterList({
  rows,
  legend,
  empty,
  footnote,
  'aria-label': ariaLabel,
}: MeterListProps) {
  return (
    <div className={styles.wrap}>
      {rows.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <>
          {legend && <MeterLegend items={legend} />}
          <ul className={styles.rows} aria-label={ariaLabel}>
            {rows.map(r => (
              <li key={r.key} className={styles.row}>
                <div className={styles.head}>
                  <span className={styles.label}>{r.label}</span>
                  {r.detail != null && <span className={styles.detail}>{r.detail}</span>}
                </div>
                <Meter segments={r.segments} hideLegend />
                {r.note != null && r.note !== '' && <p className={styles.muted}>{r.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      {footnote != null && footnote !== '' && <p className={styles.muted}>{footnote}</p>}
    </div>
  );
}
