/**
 * @fileoverview Bulk actions for the Notes page: issue drafts, cancel drafts and download PDFs,
 * run per note over the existing endpoints with `runBulk`. Notes an action doesn't apply to, and
 * every failure, are listed as skipped in a "Done" dialog and stay selected.
 */
import { useState, type ReactNode } from 'react';
import {
  useCancelBillNoteMutation,
  useIssueBillNoteMutation,
  useLazyDownloadBillNotePdfQuery,
} from '../../api/billNoteApi';
import { getErrorMessage } from '../../api/baseApi';
import { Button } from '../../components/ui';
import { getApiError } from '../../utils/apiError';
import { noteFileName } from '../../utils/billNoteLabels';
import { runBulk } from '../../utils/runBulk';
import { BulkResultDialog, useInFlightGuard, type ConfirmRequest } from '../../components/bulk';
import type { BillNote } from '../../types';

export const DEADLINE_REASON = 'too late for a credit note this year';
export const OUT_OF_DATE_REASON = 'changed since you opened it, reload';

type Skip = { note: BillNote; reason: string };
type Outcome = { line: string; skipped: Skip[] };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A note's name in lists: its number, or "Draft on <bill>" before it has one. */
export const noteLabel = (n: BillNote) => n.noteNumber ?? `Draft on ${n.billNumber}`;

const notDraftReason = (n: BillNote) =>
  n.status === 'cancelled' ? 'already cancelled' : 'already issued';

function reasonFor(err: unknown): string {
  const { code } = getApiError(err);
  if (code === 'CREDIT_NOTE_DEADLINE_PASSED') return DEADLINE_REASON;
  if (code === 'NOTE_OUT_OF_DATE') return OUT_OF_DATE_REASON;
  return getErrorMessage(err);
}

interface Options {
  businessId: string;
  /** The selected notes (row objects, table order). */
  notes: BillNote[];
  /** Called after a run with the ids that succeeded, so they leave the selection. */
  onSucceeded: (ids: string[]) => void;
  /** Opens a confirm dialog (from the page's `useConfirm`). */
  ask: (request: ConfirmRequest) => void;
}

export function useBillNoteBulkActions({ businessId, notes, onSucceeded, ask }: Options) {
  const [issueNote] = useIssueBillNoteMutation();
  const [cancelNote] = useCancelBillNoteMutation();
  const [downloadPdf] = useLazyDownloadBillNotePdfQuery();
  const [running, setRunning] = useState(false);
  const guard = useInFlightGuard();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const drafts = notes.filter(n => n.status === 'draft');

  /** Runs `fn` on `items`; notes outside `items` are skipped with `skipped`'s reasons. */
  const run = async (
    items: BillNote[],
    fn: (note: BillNote) => Promise<unknown>,
    line: (done: number) => string,
    skipped: Skip[] = [],
    concurrency?: number
  ) => {
    const order = notes;
    setRunning(true);
    const results = await runBulk(items, fn, { concurrency });
    setRunning(false);
    const done: string[] = [];
    for (const r of results) {
      if (r.ok) done.push(r.item._id);
      else skipped.push({ note: r.item, reason: reasonFor(r.error) });
    }
    const position = new Map(order.map((n, i) => [n._id, i]));
    const at = (s: Skip) => position.get(s.note._id) ?? order.length;
    onSucceeded(done);
    setOutcome({ line: line(done.length), skipped: [...skipped].sort((a, b) => at(a) - at(b)) });
  };

  const notDrafts = () =>
    notes.filter(n => n.status !== 'draft').map(note => ({ note, reason: notDraftReason(note) }));

  const runIssue = guard(() =>
    run(
      drafts,
      n => issueNote({ businessId, noteId: n._id }).unwrap(),
      k => `${k} issued`,
      notDrafts()
    )
  );

  const runCancel = guard(() =>
    run(
      drafts,
      n => cancelNote({ businessId, noteId: n._id }).unwrap(),
      k => `${k} cancelled`,
      notDrafts()
    )
  );

  const runDownload = guard(() =>
    run(
      notes,
      n =>
        downloadPdf({ businessId, noteId: n._id, fileName: noteFileName(n.noteNumber) }).unwrap(),
      k => `${k} downloaded`,
      [],
      2
    )
  );

  const n = drafts.length;
  const actions: ReactNode = (
    <>
      <Button
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Issue ${n} ${plural(n, 'note', 'notes')}?`,
            body: n === 1 ? 'It will be locked.' : 'They will be locked.',
            confirmLabel: 'Issue',
            onConfirm: runIssue,
          })
        }
      >
        Issue {n}
      </Button>
      <Button
        variant="danger"
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Cancel ${n} draft ${plural(n, 'note', 'notes')}?`,
            confirmLabel: plural(n, 'Cancel note', 'Cancel notes'),
            cancelLabel: plural(n, 'Keep note', 'Keep notes'),
            danger: true,
            onConfirm: runCancel,
          })
        }
      >
        Cancel {n}
      </Button>
      <Button disabled={notes.length === 0 || running} onClick={() => runDownload()}>
        Download {notes.length} {plural(notes.length, 'PDF', 'PDFs')}
      </Button>
    </>
  );

  const dialog: ReactNode = outcome ? (
    <BulkResultDialog
      lines={[outcome.line]}
      skipped={outcome.skipped.map(({ note, reason }) => ({ label: noteLabel(note), reason }))}
      noun="notes"
      onClose={() => setOutcome(null)}
    />
  ) : null;

  return { actions, dialog, running };
}
