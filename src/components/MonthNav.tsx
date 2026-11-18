/**
 * @fileoverview Month navigation row: previous / next IconButtons around the month label.
 * Used by the attendance calendar and the salary tab.
 */
import { IconButton } from './ui';
import styles from './MonthNav.module.css';

interface MonthNavProps {
  /** e.g. "November 2026" */
  label: string;
  onPrev: () => void;
  onNext: () => void;
  /** Disable "Next month" (no future months) */
  nextDisabled?: boolean;
}

export function MonthNav({ label, onPrev, onNext, nextDisabled = false }: MonthNavProps) {
  return (
    <div className={styles.nav}>
      <IconButton label="Previous month" icon="arrow-left" onClick={onPrev} />
      <span className={styles.label} aria-live="polite">
        {label}
      </span>
      <IconButton label="Next month" icon="arrow-right" onClick={onNext} disabled={nextDisabled} />
    </div>
  );
}
