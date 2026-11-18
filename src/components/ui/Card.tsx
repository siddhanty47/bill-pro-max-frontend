import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Card.module.css';

export type CardProps = {
  title?: string;
  to?: string;
  count?: number;
  countTone?: 'danger' | 'neutral';
  actions?: ReactNode;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Card({
  title,
  to,
  count,
  countTone = 'neutral',
  actions,
  padded = true,
  className,
  children,
}: CardProps) {
  const classes = [styles.card, to ? styles.clickable : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {(title || actions) && (
        <div className={styles.head}>
          {title && (
            <h2 className={styles.title}>
              {title}
              {count !== undefined && (
                <span className={`${styles.count} ${styles[countTone]}`}>{count}</span>
              )}
            </h2>
          )}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {padded ? <div className={styles.body}>{children}</div> : children}
    </>
  );
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <section className={classes}>{content}</section>
  );
}
