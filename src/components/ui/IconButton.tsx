import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export type IconButtonProps = {
  label: string;
  badge?: boolean;
} & (
  | { icon: IconName; children?: never }
  /** A non-interactive glyph other than an Icon, e.g. an `Avatar` for the account menu. */
  | { icon?: never; children: ReactNode }
) &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export function IconButton({
  label,
  icon,
  badge = false,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={[styles.iconBtn, className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon ? <Icon name={icon} size={18} /> : children}
      {badge && <span className={styles.badge} aria-hidden="true" />}
    </button>
  );
}
