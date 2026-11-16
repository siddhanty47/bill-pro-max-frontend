import type { ReactNode } from 'react';
import styles from './StatusChip.module.css';
import { statusLabel, statusTone, type Tone } from './status';

export type StatusChipProps = {
  status: string;
  tone?: Tone;
  children?: ReactNode;
  /** Native tooltip, e.g. to explain a non-lifecycle chip. */
  title?: string;
};

export function StatusChip({ status, tone, children, title }: StatusChipProps) {
  const resolved = tone ?? statusTone(status);
  return (
    <span className={`${styles.chip} ${styles[resolved]}`} title={title}>
      {children ?? statusLabel(status)}
    </span>
  );
}
