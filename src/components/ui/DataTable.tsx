import {
  Fragment,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { fromInnerControl } from './innerControl';
import type { ValueTone } from './status';
import { Table, THead, TBody, Tr, Th, Td } from './Table';
import { RowLinkContext, type RowLinkValue } from './rowLink';
import { useNavigate } from 'react-router-dom';
import { recordNavState, type ServerListSource } from '../../utils/recordNav';
import styles from './DataTable.module.css';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  hideOnMobile?: boolean;
  nowrap?: boolean;
  /** Colour this row's value (e.g. a negative count): passed to the cell's `Td tone`. */
  tone?: (row: T) => ValueTone | undefined;
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
  /**
   * Detail path of a row. Makes rows clickable (like `onRowClick`, which it overrides) and
   * lets the detail page step Prev/Next through this table: links in the row to the same
   * path (`DocNumber`/`TextLink`) carry the nav state too.
   */
  rowLink?: (row: T) => string;
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
    /** The list args of a server-paged challan/bill table, so Prev/Next can fetch neighbouring pages. */
    navSource?: ServerListSource;
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
  rowState,
  ariaLabel,
}: {
  spec: DataTableMobile<T>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T, i: number) => void;
  rowState?: (row: T, i: number) => RowLinkValue | null;
  ariaLabel?: string;
}) {
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {rows.map((row, i) => {
        const badge = spec.badge?.(row);
        const subtitle = spec.subtitle?.(row);
        const meta = (spec.meta?.(row) ?? []).filter(m => !isEmpty(m));
        const actions = spec.actions?.(row);
        const trailing = spec.actionsPlacement === 'trailing';
        const interactive = onRowClick
          ? {
              tabIndex: 0,
              onClick: (e: MouseEvent<HTMLLIElement>) => {
                if (!fromInnerControl(e)) onRowClick(row, i);
              },
              onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  // Space would otherwise scroll the page.
                  if (e.key === ' ') e.preventDefault();
                  onRowClick(row, i);
                }
              },
            }
          : {};
        const link = rowState?.(row, i) ?? null;
        return (
          <RowLinkContext.Provider key={rowKey(row)} value={link}>
            <li
              className={[styles.item, onRowClick ? styles.clickable : '']
                .filter(Boolean)
                .join(' ')}
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
          </RowLinkContext.Provider>
        );
      })}
    </ul>
  );
}

function DataTableView<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLink,
  navigate,
  empty,
  'aria-label': ariaLabel,
  mobile,
  pageSize = DEFAULT_PAGE_SIZE,
  pagination,
}: DataTableProps<T> & { navigate?: (to: string, state: RowLinkValue['state']) => void }) {
  const paths = useMemo(() => (rowLink ? rows.map(rowLink) : []), [rows, rowLink]);
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
  const offset = pagination ? 0 : (clientPage - 1) * pageSize;
  const server =
    pagination?.navSource === undefined
      ? undefined
      : { source: pagination.navSource, page: pagination.page, total: pagination.total };
  const rowState = rowLink
    ? (_row: T, i: number): RowLinkValue => ({
        to: paths[offset + i],
        state: recordNavState({ paths, index: offset + i, ...(server && { server }) }),
      })
    : undefined;
  const activate =
    rowLink && navigate
      ? (row: T, i: number) => {
          const link = rowState!(row, i);
          navigate(link.to, link.state);
        }
      : onRowClick
        ? (row: T) => onRowClick(row)
        : undefined;
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
        {visible.map((row, i) => (
          <RowLinkContext.Provider key={rowKey(row)} value={rowState?.(row, i) ?? null}>
            <Tr onClick={activate ? () => activate(row, i) : undefined}>
              {columns.map(c => (
                <Td
                  key={c.key}
                  align={c.align}
                  mono={c.mono}
                  hideOnMobile={c.hideOnMobile}
                  nowrap={c.nowrap}
                  tone={c.tone?.(row)}
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </Td>
              ))}
            </Tr>
          </RowLinkContext.Provider>
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
        onRowClick={activate}
        rowState={rowState}
        ariaLabel={ariaLabel}
      />
      {pager}
    </>
  );
}

/** Only mounted when `rowLink` is set, so tables without it keep working outside a router. */
function LinkedDataTable<T>(props: DataTableProps<T>) {
  const navigate = useNavigate();
  return <DataTableView {...props} navigate={(to, state) => navigate(to, { state })} />;
}

export function DataTable<T>(props: DataTableProps<T>) {
  return props.rowLink ? <LinkedDataTable {...props} /> : <DataTableView {...props} />;
}
