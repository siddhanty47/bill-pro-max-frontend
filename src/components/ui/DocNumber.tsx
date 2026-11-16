import { Link } from 'react-router-dom';
import styles from './DocNumber.module.css';

export type DocNumberProps = {
  value: string;
  to?: string;
};

export function DocNumber({ value, to }: DocNumberProps) {
  return to ? (
    <Link to={to} className={`${styles.docno} ${styles.link}`}>
      {value}
    </Link>
  ) : (
    <span className={styles.docno}>{value}</span>
  );
}
