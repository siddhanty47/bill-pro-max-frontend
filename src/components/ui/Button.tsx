import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
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
  const inert = Boolean(disabled || loading);
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    loading ? styles.loading : '',
    inert ? styles.inert : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={loading ? `${styles.content} ${styles.contentHidden}` : styles.content}>
        {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
        {children}
      </span>
    </>
  );

  if (to || href) {
    const { onClick, ...anchorRest } = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    const anchorProps: AnchorHTMLAttributes<HTMLAnchorElement> = {
      ...anchorRest,
      className: classes,
      onClick: (e: MouseEvent<HTMLAnchorElement>) => {
        if (inert) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      },
      ...(inert && { 'aria-disabled': true, tabIndex: -1 }),
      ...(loading && { 'aria-busy': true }),
    };
    return to ? (
      <Link to={to} {...anchorProps}>
        {content}
      </Link>
    ) : (
      <a href={href} {...anchorProps}>
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
