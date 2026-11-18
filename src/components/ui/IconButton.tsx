import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export type IconButtonProps = {
  label: string;
  icon: IconName;
  badge?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({
  label,
  icon,
  badge = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={[styles.iconBtn, className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon} size={18} />
      {badge && <span className={styles.badge} aria-hidden="true" />}
    </button>
  );
}
