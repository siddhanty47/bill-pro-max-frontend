import styles from './Meter.module.css';

export type MeterTone = 'accent' | 'info' | 'warning' | 'danger';
export type MeterSegment = { value: number; tone: MeterTone; label: string };

const fmt = (n: number) => n.toLocaleString('en-IN');
const round1 = (n: number) => Math.round(n * 10) / 10;

export function Meter({ segments }: { segments: MeterSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const ariaLabel = segments.map(s => `${s.label} ${fmt(s.value)} of ${fmt(total)}`).join(', ');

  // Round each width once, then place every segment at the sum of the rounded widths
  // before it, and give the last one the remainder: no 0.1% gaps or overlaps.
  let offset = 0;
  const rects =
    total > 0
      ? segments.map((s, i) => {
          const x = offset;
          const width =
            i === segments.length - 1
              ? Math.max(0, round1(100 - x))
              : round1((s.value / total) * 100);
          offset = round1(offset + width);
          return (
            <rect
              key={i}
              className={styles[s.tone]}
              x={`${x}%`}
              y="0"
              width={`${width}%`}
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
        {segments.map((s, i) => (
          <li key={i} className={styles.item}>
            <span className={`${styles.swatch} ${styles[`sw-${s.tone}`]}`} aria-hidden="true" />
            {s.label} <span className="mono">{fmt(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
