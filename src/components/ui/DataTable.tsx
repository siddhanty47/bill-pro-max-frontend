import { Fragment, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
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
};

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
                if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
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
                        {i > 0 && ' · '}
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
}: DataTableProps<T>) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
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
        {rows.map(row => (
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
  if (!mobile) return table;
  // Both render; CSS shows the table above 768px and the list at or below it.
  return (
    <>
      {table}
      <MobileList
        spec={mobile}
        rows={rows}
        rowKey={rowKey}
        onRowClick={onRowClick}
        ariaLabel={ariaLabel}
      />
    </>
  );
}
