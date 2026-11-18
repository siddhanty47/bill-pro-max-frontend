import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export type EmptyStateProps = {
  title: string;
  action?: ReactNode;
};

export function EmptyState({ title, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {action}
    </div>
  );
}
