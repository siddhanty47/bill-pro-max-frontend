import type { ReactNode } from 'react';
import styles from './StatusChip.module.css';
import { statusLabel, statusTone, type Tone } from './status';

export type StatusChipProps = {
  status: string;
  tone?: Tone;
  children?: ReactNode;
};

export function StatusChip({ status, tone, children }: StatusChipProps) {
  const resolved = tone ?? statusTone(status);
  return (
    <span className={`${styles.chip} ${styles[resolved]}`}>{children ?? statusLabel(status)}</span>
  );
}
