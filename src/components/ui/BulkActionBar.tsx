import { useEffect, useRef, type ReactNode } from 'react';
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

/** The spacer's height, set from the bar's measured height (CSS falls back without it). */
const BAR_HEIGHT_VAR = '--bulk-bar-height';

/**
 * "{count} {noun} selected", the bulk actions and Clear. Sticky at the bottom of the
 * content area on desktop; a fixed bottom bar (safe-area padded) on phones.
 */
export function BulkActionBar({ count, noun, onClear, children, className }: BulkActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const shown = count > 0;

  // Phones: keep the spacer exactly as tall as the fixed bar, however many rows its buttons wrap to.
  useEffect(() => {
    const bar = barRef.current;
    const spacer = spacerRef.current;
    if (!shown || !bar || !spacer || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = bar.getBoundingClientRect().height;
      if (height > 0) spacer.style.setProperty(BAR_HEIGHT_VAR, `${height}px`);
      else spacer.style.removeProperty(BAR_HEIGHT_VAR);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [shown]);

  if (!shown) return null;
  return (
    <>
      <div
        ref={barRef}
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
      <div ref={spacerRef} className={styles.spacer} aria-hidden="true" />
    </>
  );
}
