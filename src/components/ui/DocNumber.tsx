import { Link } from 'react-router-dom';
import styles from './DocNumber.module.css';

export type DocNumberProps = {
  value: string;
  to?: string;
  /** Let a long code wrap (e.g. in a narrow sidebar) instead of staying on one line. */
  wrap?: boolean;
};

export function DocNumber({ value, to, wrap = false }: DocNumberProps) {
  const base = wrap ? `${styles.docno} ${styles.wrap}` : styles.docno;
  return to ? (
    <Link to={to} className={`${base} ${styles.link}`}>
      {value}
    </Link>
  ) : (
    <span className={base}>{value}</span>
  );
}
