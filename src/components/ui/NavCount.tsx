import styles from './NavCount.module.css';

export type NavCountTone = 'neutral' | 'danger';

export interface NavCountProps {
  /** The count; nothing renders when it is 0 or undefined. */
  value?: number;
  /** Short suffix in the pill, e.g. "draft". */
  label?: string;
  tone?: NavCountTone;
  /** Screen-reader wording after the number, e.g. "draft challans". */
  description?: string;
}

const format = (n: number) => n.toLocaleString('en-IN');

/**
 * Right-aligned count pill for a nav link (sidebar badges). The pill is
 * `aria-hidden`; a visually hidden span gives the link ", 7 overdue bills".
 * Place it as the last child of the link.
 */
export function NavCount({ value, label, tone = 'neutral', description }: NavCountProps) {
  if (!value || value < 0) return null;
  const shown = value > 999 ? '999+' : format(value);
  return (
    <>
      <span className={styles.hidden}>
        , {format(value)}
        {description ? ` ${description}` : ''}
      </span>
      <span className={`${styles.pill} ${styles[tone]}`} aria-hidden="true">
        <span className={styles.value}>{shown}</span>
        {label && <span>{` ${label}`}</span>}
      </span>
    </>
  );
}
