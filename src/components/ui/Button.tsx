import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Dot, type DotTone } from './Dot';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  /** At ≤768 the label is visually hidden (kept in the accessible name) and the button becomes a 44px icon square. Needs `icon`. */
  collapseLabel?: boolean;
  /** Small status-tone dot before the label (e.g. delivery = info, return = warning). */
  dot?: DotTone;
  /** Keyboard-shortcut hint shown after the label (hidden at ≤768). Decorative: wire the key itself with `useHotkey`. */
  hint?: string;
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
  collapseLabel = false,
  dot,
  hint,
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
    collapseLabel ? styles.collapse : '',
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
        {dot && <Dot tone={dot} />}
        {collapseLabel ? <span className={styles.collapsibleLabel}>{children}</span> : children}
        {hint && (
          <kbd className={styles.hint} aria-hidden="true">
            {hint}
          </kbd>
        )}
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
