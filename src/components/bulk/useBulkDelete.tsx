/**
 * @fileoverview Bulk delete for a list page (parties, inventory): a `Delete {n}` button that
 * asks `Delete {n} <noun>? This can't be undone.`, deletes each eligible row over the
 * single-row endpoint with `runBulk`, and shows the "Done" dialog. Ineligible rows and server
 * refusals (with the server's message) are listed as skipped and stay selected.
 */
import type { ReactNode } from 'react';
import { getErrorMessage } from '../../api/baseApi';
import { runBulk } from '../../utils/runBulk';
import { Button } from '../ui';
import type { ConfirmRequest } from './BulkConfirmDialog';
import { splitResults, type RowSkip } from './bulkRun';
import { useBulkOutcome } from './useBulkOutcome';

export type BulkDeleteOptions<T> = {
  /** The selected rows, in table order. */
  rows: T[];
  rowKey: (row: T) => string;
  /** The row's name in the "Done" dialog. */
  label: (row: T) => string;
  /** Deletes one row; a rejection becomes a skip with the server's message. */
  remove: (row: T) => Promise<unknown>;
  /** Why a row can't be deleted, or null when it can (default: every row can). */
  skipReason?: (row: T) => string | null;
  noun: { one: string; many: string };
  /** Opens a confirm dialog (from the page's `useConfirm`). */
  ask: (request: ConfirmRequest) => void;
  /** Called with the keys that were deleted, so they leave the selection. */
  onSucceeded: (keys: string[]) => void;
};

export function useBulkDelete<T>({
  rows,
  rowKey,
  label,
  remove,
  skipReason,
  noun,
  ask,
  onSucceeded,
}: BulkDeleteOptions<T>) {
  const { running, guard, busy, finish, dialog } = useBulkOutcome<T>({
    rowKey,
    label,
    noun: noun.many,
    monoLabels: false,
    onSucceeded,
  });

  const eligible = rows.filter(r => !skipReason?.(r));
  const n = eligible.length;

  const run = guard(async () => {
    const order = rows;
    const items = eligible;
    const skipped: Array<RowSkip<T>> = order.flatMap(row => {
      const reason = skipReason?.(row);
      return reason ? [{ row, reason }] : [];
    });
    const results = await busy(() => runBulk(items, remove));
    const deleted = splitResults(results, rowKey, getErrorMessage);
    finish(`${deleted.done.length} deleted`, deleted.done, [...skipped, ...deleted.skipped], order);
  });

  const button: ReactNode = (
    <Button
      variant="danger"
      disabled={n === 0 || running}
      onClick={() =>
        ask({
          title: `Delete ${n} ${n === 1 ? noun.one : noun.many}?`,
          body: "This can't be undone.",
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: run,
        })
      }
    >
      Delete {n}
    </Button>
  );

  return { button, dialog, running };
}
