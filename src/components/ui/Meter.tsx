import styles from './Meter.module.css';

export type MeterTone = 'accent' | 'info' | 'warning' | 'danger';
export type MeterSegment = { value: number; tone: MeterTone; label: string };

const fmt = (n: number) => n.toLocaleString('en-IN');
const round1 = (n: number) => Math.round(n * 10) / 10;

export function Meter({ segments }: { segments: MeterSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const ariaLabel = segments.map(s => `${s.label} ${fmt(s.value)} of ${fmt(total)}`).join(', ');

  let offset = 0;
  const rects =
    total > 0
      ? segments.map(s => {
          const width = (s.value / total) * 100;
          const x = offset;
          offset += width;
          return (
            <rect
              key={s.label}
              className={styles[s.tone]}
              x={`${round1(x)}%`}
              y="0"
              width={`${round1(width)}%`}
              height="6"
            />
          );
        })
      : null;

  return (
    <div className={styles.meter}>
      <svg
        className={styles.bar}
        width="100%"
        height="6"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {rects}
      </svg>
      <ul className={styles.legend}>
        {segments.map(s => (
          <li key={s.label} className={styles.item}>
            <span className={`${styles.swatch} ${styles[`sw-${s.tone}`]}`} aria-hidden="true" />
            {s.label} <span className="mono">{fmt(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
