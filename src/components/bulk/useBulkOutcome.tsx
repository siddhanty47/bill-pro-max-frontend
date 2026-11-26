/**
 * @fileoverview The run plumbing every bulk-action hook shares: the `running` flag, the
 * in-flight guard against double runs, the outcome of the last run and its "Done" dialog.
 */
import { useState, type ReactNode } from 'react';
import { BulkResultDialog, type BulkSkip } from './BulkResultDialog';
import { downloadPdfs, type RowSkip } from './bulkRun';
import { useInFlightGuard } from './useInFlightGuard';

export type BulkOutcomeOptions<T> = {
  rowKey: (row: T) => string;
  /** The row's name in the "Done" dialog's skipped list. */
  label: (row: T) => ReactNode;
  /** Plural noun for the skipped list's accessible name ("Skipped bills"). */
  noun: string;
  /** Labels in the number font (default true, for document numbers); per row with a function. */
  monoLabels?: boolean | ((row: T) => boolean);
  /** Called after a run with the keys that succeeded, so they leave the selection. */
  onSucceeded: (keys: string[]) => void;
};

export function useBulkOutcome<T>({
  rowKey,
  label,
  noun,
  monoLabels = true,
  onSucceeded,
}: BulkOutcomeOptions<T>) {
  const [running, setRunning] = useState(false);
  // Blocks a second run while one is going (a fast double click lands before `running` renders).
  const guard = useInFlightGuard();
  const [outcome, setOutcome] = useState<{ line: string; skipped: BulkSkip[] } | null>(null);

  /** Runs `work` with `running` set. */
  const busy = async <R,>(work: () => Promise<R>): Promise<R> => {
    setRunning(true);
    try {
      return await work();
    } finally {
      setRunning(false);
    }
  };

  /**
   * Ends a run: `done` leave the selection and the "Done" dialog shows `line` and the skips,
   * listed in the order of `order` (the run's rows).
   */
  const finish = (line: string, done: string[], skipped: Array<RowSkip<T>>, order: T[]) => {
    const position = new Map(order.map((row, i) => [rowKey(row), i]));
    const at = (s: RowSkip<T>) => position.get(rowKey(s.row)) ?? order.length;
    onSucceeded(done);
    setOutcome({
      line,
      skipped: [...skipped]
        .sort((a, b) => at(a) - at(b))
        .map(({ row, reason }) => ({
          label: label(row),
          reason,
          mono: typeof monoLabels === 'function' ? monoLabels(row) : monoLabels,
        })),
    });
  };

  /** Downloads a PDF per row (two at a time) and finishes with "{n} downloaded". */
  const runDownloads = guard(
    async (
      rows: T[],
      download: (row: T) => Promise<unknown>,
      reasonFor: (error: unknown) => string
    ) => {
      const { done, skipped } = await busy(() => downloadPdfs(rows, download, rowKey, reasonFor));
      finish(`${done.length} downloaded`, done, skipped, rows);
    }
  );

  const dialog: ReactNode = outcome ? (
    <BulkResultDialog
      lines={[outcome.line]}
      skipped={outcome.skipped}
      noun={noun}
      onClose={() => setOutcome(null)}
    />
  ) : null;

  return { running, guard, busy, finish, runDownloads, dialog };
}
