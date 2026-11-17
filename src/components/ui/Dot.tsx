import styles from './Dot.module.css';

export type DotTone = 'info' | 'warning' | 'success' | 'danger';

/**
 * An 8px status-tone dot (decorative, `aria-hidden`): challan type in lists, the
 * `dot` of a Button or SegmentedControl option. The meaning must also be in text.
 */
export function Dot({ tone, className }: { tone: DotTone; className?: string }) {
  return (
    <span
      className={[styles.dot, styles[tone], className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
