import styles from './ProgressBar.module.css';

export type ProgressBarProps = {
  value: number;
  max: number;
  /** Accessible name, e.g. "Bill generation progress". */
  label: string;
  className?: string;
};

/**
 * Thin determinate progress bar. Takes the surrounding text colour (so it matches a `Notice`
 * tone); the width is an SVG attribute, never an inline style.
 */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <svg
      className={[styles.bar, className ?? ''].filter(Boolean).join(' ')}
      width="100%"
      height="6"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      preserveAspectRatio="none"
    >
      <rect className={styles.track} x="0" y="0" width="100%" height="6" />
      <rect className={styles.fill} x="0" y="0" width={`${pct}%`} height="6" />
    </svg>
  );
}
