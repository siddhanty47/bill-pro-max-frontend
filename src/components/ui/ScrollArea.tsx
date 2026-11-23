import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './ScrollArea.module.css';

export type ScrollAreaProps = {
  /** Accessible name of the scroll region. */
  label: string;
  className?: string;
  /** Called after the region scrolls (the affordance is updated first). */
  onScroll?: (scrollLeft: number) => void;
  children: ReactNode;
};

/** Share of the visible width one ‹ › press scrolls. */
const STEP = 0.8;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/**
 * Horizontal scroll container with an affordance: an edge fade and a ‹ / › button on each
 * side that has hidden content, and one small nudge the first time it scrolls into view
 * (skipped under reduced motion or when everything fits). The region is focusable, so arrow
 * keys scroll it natively.
 */
export function ScrollArea({ label, className, onScroll, children }: ScrollAreaProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [nudge, setNudge] = useState(false);

  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    window.addEventListener('resize', measure);
    let resize: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resize = new ResizeObserver(() => measure());
      resize.observe(el);
      if (inner.current) resize.observe(inner.current);
    }
    let seen: IntersectionObserver | undefined;
    let nudged = false;
    if (typeof IntersectionObserver !== 'undefined') {
      seen = new IntersectionObserver(entries => {
        if (nudged || !entries.some(e => e.isIntersecting)) return;
        nudged = true; // once per mount
        seen?.disconnect();
        if (!reducedMotion() && el.scrollWidth > el.clientWidth + 1) setNudge(true);
      });
      seen.observe(el);
    }
    return () => {
      window.removeEventListener('resize', measure);
      resize?.disconnect();
      seen?.disconnect();
    };
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const el = viewport.current;
    if (!el) return;
    const left = Math.round(el.clientWidth * STEP) * direction;
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else {
      el.scrollLeft += left;
    }
  };

  return (
    <div className={[styles.root, className ?? ''].filter(Boolean).join(' ')}>
      <div
        ref={viewport}
        className={styles.viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={e => {
          measure();
          onScroll?.(e.currentTarget.scrollLeft);
        }}
      >
        <div
          ref={inner}
          className={nudge ? `${styles.inner} ${styles.nudge}` : styles.inner}
          onAnimationEnd={() => setNudge(false)}
        >
          {children}
        </div>
      </div>
      {edges.left && (
        <>
          <span className={`${styles.fade} ${styles.fadeLeft}`} aria-hidden="true" />
          <IconButton
            className={`${styles.button} ${styles.buttonLeft}`}
            label="Scroll left"
            icon="chevron-left"
            onClick={() => scroll(-1)}
          />
        </>
      )}
      {edges.right && (
        <>
          <span className={`${styles.fade} ${styles.fadeRight}`} aria-hidden="true" />
          <IconButton
            className={`${styles.button} ${styles.buttonRight}`}
            label="Scroll right"
            icon="chevron-right"
            onClick={() => scroll(1)}
          />
        </>
      )}
    </div>
  );
}
