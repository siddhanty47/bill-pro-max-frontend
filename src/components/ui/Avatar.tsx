import styles from './Avatar.module.css';

export type AvatarProps = {
  initials: string;
  size?: 'sm' | 'md';
  /** person: round neutral (account). business: rounded-square accent letter badge. */
  variant?: 'person' | 'business';
  className?: string;
};

/**
 * Initials badge. Non-interactive and aria-hidden: put it inside a Button or
 * IconButton, which carries the accessible name and the tap area.
 */
export function Avatar({ initials, size = 'md', variant = 'person', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.avatar, styles[size], styles[variant], className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {initials}
    </span>
  );
}
