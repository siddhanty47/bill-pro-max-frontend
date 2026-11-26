import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './BulkActionBar.module.css';

export type BulkActionBarProps = {
  /** Number of selected rows. The bar renders nothing at 0. */
  count: number;
  /** What is selected, already in the right number for `count` (e.g. "bill" / "bills"). */
  noun: string;
  /** Clears the selection (the bar's own "Clear" button). */
  onClear: () => void;
  /** The action buttons (kit `Button`s). */
  children?: ReactNode;
  /** Placement only. */
  className?: string;
};

/**
 * "{count} {noun} selected", the bulk actions and Clear. Sticky at the bottom of the
 * content area on desktop; a fixed bottom bar (safe-area padded) on phones.
 */
export function BulkActionBar({ count, noun, onClear, children, className }: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className={[styles.bar, className ?? ''].filter(Boolean).join(' ')}
      >
        <span className={styles.count} aria-live="polite">
          <span className={styles.number}>{count}</span> {noun} selected
        </span>
        <div className={styles.actions}>
          {children}
          <Button variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
      {/* Phones: room under the page content so the fixed bar never covers the last row. */}
      <div className={styles.spacer} aria-hidden="true" />
    </>
  );
}
