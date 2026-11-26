/**
 * @fileoverview Row selection for a list page's bulk actions: the selected keys, the rows
 * they match on this page, the kit `DataTable selection` prop, and the phone-only
 * "Select all on this page" / "Clear selection" button (the table's header checkbox is
 * hidden on phones).
 */
import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Button, type DataTableSelection } from '../ui';
import styles from './BulkDialogs.module.css';

export type BulkSelectionOptions<T> = {
  /** The rows the table shows (this page). */
  rows: T[];
  rowKey: (row: T) => string;
  /** Changes on page, filter, search or business change; a change clears the selection. */
  resetKey: string;
  /** The row checkbox's accessible name, e.g. `b => \`Select ${b.billNumber}\``. */
  label?: (row: T) => string;
  /** Rows that can't be selected get no checkbox (default: every row). */
  isSelectable?: (row: T) => boolean;
};

export type BulkSelection<T> = {
  selected: ReadonlySet<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  /** Selected rows among `rows`, in table order. */
  selectedRows: T[];
  clear: () => void;
  /** Drops these keys (e.g. the rows a bulk run succeeded on). */
  remove: (keys: string[]) => void;
  /** Pass as `DataTable selection`. */
  selectionProp: DataTableSelection<T>;
  /** Render above the table; shows on phones only, and only when a row can be selected. */
  mobileSelectAll: ReactNode;
};

export function useBulkSelection<T>({
  rows,
  rowKey,
  resetKey,
  label,
  isSelectable,
}: BulkSelectionOptions<T>): BulkSelection<T> {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setSelected(new Set());
  }

  const selectedRows = rows.filter(row => selected.has(rowKey(row)));
  const selectableKeys = (isSelectable ? rows.filter(isSelectable) : rows).map(rowKey);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selected.has(k));

  const clear = () => setSelected(new Set());
  const remove = (keys: string[]) =>
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.delete(k));
      return next;
    });

  const mobileSelectAll =
    selectableKeys.length > 0 ? (
      <div className={styles.mobileSelect}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(allSelected ? new Set() : new Set(selectableKeys))}
        >
          {allSelected ? 'Clear selection' : 'Select all on this page'}
        </Button>
      </div>
    ) : null;

  return {
    selected,
    setSelected,
    selectedRows,
    clear,
    remove,
    selectionProp: { selected, onChange: setSelected, label, isSelectable },
    mobileSelectAll,
  };
}
