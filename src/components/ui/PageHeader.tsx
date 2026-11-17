import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export type PageHeaderProps = {
  title: string;
  /** Context line above the title, in the text font; wrap codes/numbers in `.mono`. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Shown beside the title, e.g. a `StatusChip` on a detail page. */
  badge?: ReactNode;
};

export function PageHeader({ title, eyebrow, actions, badge }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {badge ? (
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {badge}
          </div>
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
