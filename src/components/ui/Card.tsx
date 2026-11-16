import type { ReactNode } from 'react';
import styles from './Card.module.css';

export type CardProps = {
  title?: string;
  count?: number;
  countTone?: 'danger' | 'neutral';
  actions?: ReactNode;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Card({
  title,
  count,
  countTone = 'neutral',
  actions,
  padded = true,
  className,
  children,
}: CardProps) {
  const classes = [styles.card, className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={classes}>
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
    </section>
  );
}
