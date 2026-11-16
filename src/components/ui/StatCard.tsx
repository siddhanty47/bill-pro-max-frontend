import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './StatCard.module.css';

export type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: IconName;
  tone?: 'default' | 'highlight';
  className?: string;
  children?: ReactNode;
};

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  className,
  children,
}: StatCardProps) {
  const classes = [styles.stat, tone === 'highlight' ? styles.highlight : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <div className={styles.label}>
        {icon && <Icon name={icon} size={16} />}
        {label}
      </div>
      <div className={`${styles.value} mono`}>{value}</div>
      {children}
    </div>
  );
}
