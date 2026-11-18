import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export type PageHeaderProps = {
  title: string;
  /** Muted line under the title. Only for context shown nowhere else on the page. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shown beside the title, e.g. a `StatusChip` on a detail page. */
  badge?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        {badge ? (
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {badge}
          </div>
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
