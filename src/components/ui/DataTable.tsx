import { Fragment, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { fromInnerControl } from './innerControl';
import { Table, THead, TBody, Tr, Th, Td } from './Table';
import styles from './DataTable.module.css';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  hideOnMobile?: boolean;
  nowrap?: boolean;
};

/**
 * Phone (≤768) list row. Line 1: leading + title, badge pushed right.
 * Line 2: subtitle, then meta parts joined with " · " (empty parts skipped).
 * Actions sit below and never trigger the row click.
 */
export type DataTableMobile<T> = {
  title: (row: T) => ReactNode;
  leading?: (row: T) => ReactNode;
  badge?: (row: T) => ReactNode;
  subtitle?: (row: T) => ReactNode;
  meta?: (row: T) => ReactNode[];
  actions?: (row: T) => ReactNode;
  /** `below` (default): actions on their own line under the row. `trailing`: top-right of the title line, after any badge. */
  actionsPlacement?: 'below' | 'trailing';
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** Names the table (and the phone list). */
  'aria-label'?: string;
  /** When set, phones get a two-line list instead of the scrolling table. */
  mobile?: DataTableMobile<T>;
  /**
   * Rows per page when the table pages `rows` itself (default 25). The pager only
   * appears when there are more rows than this, and it goes back to page 1 when
   * the rows change (a filter or search).
   */
  pageSize?: number;
  /**
   * Server-side paging: `rows` is already the current page and the backend gave
   * `total`. The table shows the pager and calls `onPageChange`; it does not slice.
   */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
};

/** Default rows per page for every table. */
export const DEFAULT_PAGE_SIZE = 25;

const isEmpty = (n: ReactNode) => n === null || n === undefined || n === false || n === '';

function MobileList<T>({
  spec,
  rows,
  rowKey,
  onRowClick,
  ariaLabel,
}: {
  spec: DataTableMobile<T>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}) {
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {rows.map(row => {
        const badge = spec.badge?.(row);
        const subtitle = spec.subtitle?.(row);
        const meta = (spec.meta?.(row) ?? []).filter(m => !isEmpty(m));
        const actions = spec.actions?.(row);
        const trailing = spec.actionsPlacement === 'trailing';
        const interactive = onRowClick
          ? {
              tabIndex: 0,
              onClick: (e: MouseEvent<HTMLLIElement>) => {
                if (!fromInnerControl(e)) onRowClick(row);
              },
              onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  // Space would otherwise scroll the page.
                  if (e.key === ' ') e.preventDefault();
                  onRowClick(row);
                }
              },
            }
          : {};
        return (
          <li
            key={rowKey(row)}
            className={[styles.item, onRowClick ? styles.clickable : ''].filter(Boolean).join(' ')}
            {...interactive}
          >
            <div className={styles.line1}>
              {spec.leading?.(row)}
              <span className={styles.title}>{spec.title(row)}</span>
              {trailing
                ? (!isEmpty(badge) || !isEmpty(actions)) && (
                    <span className={styles.end}>
                      {!isEmpty(badge) && <span className={styles.badge}>{badge}</span>}
                      {!isEmpty(actions) && <span className={styles.trailing}>{actions}</span>}
                    </span>
                  )
                : !isEmpty(badge) && <span className={styles.badge}>{badge}</span>}
            </div>
            {(!isEmpty(subtitle) || meta.length > 0) && (
              <div className={styles.line2}>
                {!isEmpty(subtitle) && <span className={styles.subtitle}>{subtitle}</span>}
                {meta.length > 0 && (
                  <span className={styles.meta}>
                    {meta.map((m, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span aria-hidden="true"> · </span>}
                        {m}
                      </Fragment>
                    ))}
                  </span>
                )}
              </div>
            )}
            {!trailing && !isEmpty(actions) && <div className={styles.actions}>{actions}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  'aria-label': ariaLabel,
  mobile,
  pageSize = DEFAULT_PAGE_SIZE,
  pagination,
}: DataTableProps<T>) {
  const [ownPage, setOwnPage] = useState(1);
  // Back to page 1 when the rows change (filter/search) — adjusted during render.
  const signature = `${rows.length}:${rows.length ? rowKey(rows[0]) : ''}`;
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setOwnPage(1);
  }

  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clientPage = Math.min(ownPage, pageCount);
  const visible = pagination
    ? rows
    : rows.slice((clientPage - 1) * pageSize, clientPage * pageSize);
  const pager = pagination ? (
    <Pagination
      page={pagination.page}
      pageSize={pagination.pageSize}
      total={pagination.total}
      onPageChange={pagination.onPageChange}
      label={ariaLabel ? `${ariaLabel} pages` : undefined}
    />
  ) : (
    <Pagination
      page={clientPage}
      pageSize={pageSize}
      total={rows.length}
      onPageChange={setOwnPage}
      label={ariaLabel ? `${ariaLabel} pages` : undefined}
    />
  );

  const table = (
    <Table aria-label={ariaLabel} className={mobile ? styles.tableView : undefined}>
      <THead>
        <Tr>
          {columns.map(c => (
            <Th key={c.key} align={c.align} hideOnMobile={c.hideOnMobile} nowrap={c.nowrap}>
              {c.header}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {visible.map(row => (
          <Tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {columns.map(c => (
              <Td
                key={c.key}
                align={c.align}
                mono={c.mono}
                hideOnMobile={c.hideOnMobile}
                nowrap={c.nowrap}
              >
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
              </Td>
            ))}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
  if (!mobile) {
    return (
      <>
        {table}
        {pager}
      </>
    );
  }
  // Both render; CSS shows the table above 768px and the list at or below it.
  return (
    <>
      {table}
      <MobileList
        spec={mobile}
        rows={visible}
        rowKey={rowKey}
        onRowClick={onRowClick}
        ariaLabel={ariaLabel}
      />
      {pager}
    </>
  );
}
