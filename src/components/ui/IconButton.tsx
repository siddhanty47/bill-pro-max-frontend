import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export type IconButtonProps = {
  label: string;
  badge?: boolean;
  /** `danger` tints the button as an active/hazard state (e.g. recording); sets `data-tone`. */
  tone?: 'danger';
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
  tone,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-tone={tone}
      className={[styles.iconBtn, tone === 'danger' ? styles.danger : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon ? <Icon name={icon} size={18} /> : children}
      {badge && <span className={styles.badge} aria-hidden="true" />}
    </button>
  );
}
