import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import type { ValueTone } from './status';
import styles from './StatCard.module.css';

export type StatCardProps = {
  label: string;
  /** Rendered mono. Optional: a card can carry only `children` (e.g. a Meter). */
  value?: ReactNode;
  /** Colour of the value: `positive` (money in), `negative` (money out / owed), `warning`. */
  valueTone?: ValueTone;
  icon?: IconName;
  to?: string;
  tone?: 'default' | 'highlight';
  /** Short secondary line under the value (text font), e.g. a `TrendLabel` "▲ 12% vs last month". */
  note?: ReactNode;
  /** Colour of the note, like `valueTone`. */
  noteTone?: ValueTone;
  className?: string;
  children?: ReactNode;
};

export function StatCard({
  label,
  value,
  valueTone,
  icon,
  to,
  tone = 'default',
  note,
  noteTone,
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
      {value !== undefined && value !== null && value !== '' && (
        <div
          className={[styles.value, 'mono', valueTone ? styles[`tone-${valueTone}`] : '']
            .filter(Boolean)
            .join(' ')}
        >
          {value}
        </div>
      )}
      {note != null && note !== '' && (
        <div
          className={[styles.note, noteTone ? styles[`tone-${noteTone}`] : '']
            .filter(Boolean)
            .join(' ')}
        >
          {note}
        </div>
      )}
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
