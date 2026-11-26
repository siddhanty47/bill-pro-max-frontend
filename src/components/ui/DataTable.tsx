import {
  Fragment,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { EmptyState } from './EmptyState';
import { Checkbox } from './Field';
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

/**
 * Opt-in row selection (controlled). Adds a leading checkbox column (header = select /
 * clear every selectable row on the current page) and a leading checkbox on phone-list
 * items. Checkbox clicks never open the row.
 */
export type DataTableSelection<T> = {
  /** Selected row keys (`rowKey`). */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Rows that can't be selected get no checkbox (default: every row). */
  isSelectable?: (row: T) => boolean;
  /** The row checkbox's accessible name, e.g. "Select INV-0012" (default "Select row"). */
  label?: (row: T) => string;
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
   * Controlled client page (1-based) when the table pages `rows` itself (no `pagination`):
   * the table shows this page and reports changes through `onPageChange`. The parent then
   * resets it on a filter change. Without it the table keeps its own page.
   */
  page?: number;
  onPageChange?: (page: number) => void;
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
  /** Row selection with a checkbox column; see `DataTableSelection`. */
  selection?: DataTableSelection<T>;
};

/** Default rows per page for every table. */
export const DEFAULT_PAGE_SIZE = 25;

const isEmpty = (n: ReactNode) => n === null || n === undefined || n === false || n === '';

/** Per-row selection state handed to the table body and the phone list. */
type RowSelect<T> = {
  canSelect: (row: T) => boolean;
  isSelected: (row: T) => boolean;
  toggle: (row: T) => void;
  label: (row: T) => string;
};

/** A row checkbox inside a label, so the whole (≥44px on phones) hit area toggles it. */
function RowCheckbox<T>({ row, select }: { row: T; select: RowSelect<T> }) {
  return (
    <label className={styles.selectHit}>
      <Checkbox
        aria-label={select.label(row)}
        checked={select.isSelected(row)}
        onChange={() => select.toggle(row)}
      />
    </label>
  );
}

function MobileList<T>({
  spec,
  rows,
  rowKey,
  onRowClick,
  rowState,
  ariaLabel,
  select,
}: {
  spec: DataTableMobile<T>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T, i: number) => void;
  rowState?: (row: T, i: number) => RowLinkValue | null;
  ariaLabel?: string;
  select?: RowSelect<T>;
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
        const selected = select?.isSelected(row) ?? false;
        const body = (
          <>
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
          </>
        );
        return (
          <RowLinkContext.Provider key={rowKey(row)} value={link}>
            <li
              className={[
                styles.item,
                onRowClick ? styles.clickable : '',
                select ? styles.withSelect : '',
                selected ? styles.selected : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-selected={select ? selected : undefined}
              {...interactive}
            >
              {select ? (
                <>
                  <span className={styles.selectSlot}>
                    {select.canSelect(row) && <RowCheckbox row={row} select={select} />}
                  </span>
                  <div className={styles.body}>{body}</div>
                </>
              ) : (
                body
              )}
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
  selection,
  page: controlledPage,
  onPageChange: onClientPageChange,
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
  const clientPage = Math.min(controlledPage ?? ownPage, pageCount);
  const setClientPage = (next: number) => {
    setOwnPage(next);
    onClientPageChange?.(next);
  };
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
  const select: RowSelect<T> | undefined = selection && {
    canSelect: row => selection.isSelectable?.(row) ?? true,
    isSelected: row => selection.selected.has(rowKey(row)),
    toggle: row => {
      const next = new Set(selection.selected);
      const key = rowKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selection.onChange(next);
    },
    label: row => selection.label?.(row) ?? 'Select row',
  };
  // Header checkbox: every selectable row on the current page.
  const pageKeys = select ? visible.filter(select.canSelect).map(rowKey) : [];
  const pickedOnPage = selection ? pageKeys.filter(k => selection.selected.has(k)).length : 0;
  const allPicked = pageKeys.length > 0 && pickedOnPage === pageKeys.length;
  const togglePage = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    pageKeys.forEach(k => (allPicked ? next.delete(k) : next.add(k)));
    selection.onChange(next);
  };
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
      onPageChange={setClientPage}
      label={ariaLabel ? `${ariaLabel} pages` : undefined}
    />
  );

  const table = (
    <Table
      aria-label={ariaLabel}
      className={
        [mobile ? styles.tableView : '', select ? styles.selecting : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      <THead>
        <Tr>
          {select && (
            <Th className={styles.selectCell}>
              <label className={styles.selectHit}>
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allPicked}
                  disabled={pageKeys.length === 0}
                  ref={el => {
                    if (el) el.indeterminate = pickedOnPage > 0 && !allPicked;
                  }}
                  onChange={togglePage}
                />
              </label>
            </Th>
          )}
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
            <Tr
              onClick={activate ? () => activate(row, i) : undefined}
              className={select?.isSelected(row) ? styles.selected : undefined}
              data-selected={select ? select.isSelected(row) : undefined}
            >
              {select && (
                // The whole cell is the checkbox's: a near miss toggles it, never opens the row.
                <Td
                  className={styles.selectCell}
                  onClick={e => {
                    e.stopPropagation();
                    if (e.target === e.currentTarget && select.canSelect(row)) select.toggle(row);
                  }}
                >
                  {select.canSelect(row) && <RowCheckbox row={row} select={select} />}
                </Td>
              )}
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
        select={select}
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
