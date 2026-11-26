/**
 * @fileoverview Bulk actions for the Notes page: issue drafts, cancel drafts and download PDFs,
 * run per note over the existing endpoints with `runBulk`. Notes an action doesn't apply to, and
 * every failure, are listed as skipped in a "Done" dialog and stay selected.
 */
import type { ReactNode } from 'react';
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
import {
  plural,
  splitResults,
  useBulkOutcome,
  type ConfirmRequest,
  type RowSkip,
} from '../../components/bulk';
import type { BillNote } from '../../types';

export const DEADLINE_REASON = 'too late for a credit note this year';
export const OUT_OF_DATE_REASON = 'changed since you opened it, reload';

type Skip = RowSkip<BillNote>;

/** A note's name in lists: its number, or "Draft on <bill>" before it has one. */
export const noteLabel = (n: BillNote) => n.noteNumber ?? `Draft on ${n.billNumber}`;

/** `noteLabel` for the "Done" dialog, with only the bill number of a draft in mono. */
const skipLabel = (n: BillNote): ReactNode =>
  n.noteNumber ?? (
    <>
      Draft on <span className="mono">{n.billNumber}</span>
    </>
  );

/** PDF name for a bulk download: drafts are told apart by their bill, `note-draft-<bill>.pdf`. */
export const bulkNoteFileName = (n: BillNote): string =>
  noteFileName(n.noteNumber ?? `draft-${n.billNumber}`);

const notDraftReason = (n: BillNote) => (n.status === 'cancelled' ? 'cancelled' : 'already issued');

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
  const { running, guard, busy, finish, runDownloads, dialog } = useBulkOutcome<BillNote>({
    rowKey: n => n._id,
    label: skipLabel,
    noun: 'notes',
    // Numbers in the number font; a draft's label sets its bill number in mono itself.
    monoLabels: n => n.noteNumber != null,
    onSucceeded,
  });

  const drafts = notes.filter(n => n.status === 'draft');

  /** Runs `fn` on the drafts; the other notes are skipped as not drafts. */
  const runOnDrafts = async (fn: (note: BillNote) => Promise<unknown>, verb: string) => {
    const order = notes;
    const skipped: Skip[] = notes
      .filter(n => n.status !== 'draft')
      .map(row => ({ row, reason: notDraftReason(row) }));
    const results = await busy(() => runBulk(drafts, fn));
    const ran = splitResults(results, n => n._id, reasonFor);
    finish(`${ran.done.length} ${verb}`, ran.done, [...skipped, ...ran.skipped], order);
  };

  const runIssue = guard(() =>
    runOnDrafts(n => issueNote({ businessId, noteId: n._id }).unwrap(), 'issued')
  );

  const runCancel = guard(() =>
    runOnDrafts(n => cancelNote({ businessId, noteId: n._id }).unwrap(), 'cancelled')
  );

  const runDownload = () =>
    runDownloads(
      notes,
      n => downloadPdf({ businessId, noteId: n._id, fileName: bulkNoteFileName(n) }).unwrap(),
      reasonFor
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

  return { actions, dialog, running };
}
