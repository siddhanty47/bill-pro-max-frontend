import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
