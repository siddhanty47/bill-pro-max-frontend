import { Button } from './Button';
import { Icon } from './Icon';
import { pageItems } from './pageItems';
import styles from './Pagination.module.css';

export type PaginationProps = {
  /** Current page, 1-based. */
  page: number;
  pageSize: number;
  /** Total rows across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  /** Accessible name of the nav, e.g. "Challans pages" (default "Pagination"). */
  label?: string;
  className?: string;
};

/**
 * Pager under a table: "Showing 26–50 of 132", Previous, page numbers, Next.
 * Renders nothing when everything fits on one page. On phones the numbers
 * collapse to "Page 2 of 6".
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = 'Pagination',
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const current = Math.min(Math.max(1, page), pageCount);
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);

  return (
    <nav aria-label={label} className={[styles.pagination, className].filter(Boolean).join(' ')}>
      <p className={styles.summary} aria-live="polite">
        Showing <span className="mono">{first}</span>–<span className="mono">{last}</span> of{' '}
        <span className="mono">{total}</span>
      </p>
      <div className={styles.controls}>
        <Button
          size="sm"
          variant="ghost"
          icon="arrow-left"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
        >
          Previous
        </Button>
        <ol className={styles.pages}>
          {pageItems(current, pageCount).map(item =>
            typeof item === 'number' ? (
              <li key={item}>
                <Button
                  size="sm"
                  variant={item === current ? 'secondary' : 'ghost'}
                  aria-current={item === current ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => item !== current && onPageChange(item)}
                >
                  <span className="mono">{item}</span>
                </Button>
              </li>
            ) : (
              <li key={item} className={styles.gap} aria-hidden="true">
                …
              </li>
            )
          )}
        </ol>
        <p className={styles.compact}>
          Page <span className="mono">{current}</span> of <span className="mono">{pageCount}</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={current === pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          Next
          <Icon name="arrow-right" size={14} />
        </Button>
      </div>
    </nav>
  );
}
