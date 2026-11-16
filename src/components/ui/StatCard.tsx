import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import styles from './StatCard.module.css';

export type StatCardProps = {
  label: string;
  value: ReactNode;
  icon?: IconName;
  to?: string;
  tone?: 'default' | 'highlight';
  className?: string;
  children?: ReactNode;
};

export function StatCard({
  label,
  value,
  icon,
  to,
  tone = 'default',
  className,
  children,
}: StatCardProps) {
  const classes = [
    styles.stat,
    tone === 'highlight' ? styles.highlight : '',
    to ? styles.clickable : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      <div className={styles.label}>
        {icon && <Icon name={icon} size={16} />}
        {label}
      </div>
      <div className={`${styles.value} mono`}>{value}</div>
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
