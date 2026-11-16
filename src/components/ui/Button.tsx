import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  to?: string;
  href?: string;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  to,
  href,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}
