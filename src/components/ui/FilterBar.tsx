import type { HTMLAttributes } from 'react';
import styles from './FilterBar.module.css';

export type FilterBarProps = HTMLAttributes<HTMLDivElement>;

export function FilterBar({ className, children, ...rest }: FilterBarProps) {
  return (
    <div className={[styles.bar, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
