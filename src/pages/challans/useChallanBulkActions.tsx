/**
 * @fileoverview Bulk actions for the Challans table: confirm drafts and download PDFs, run per
 * challan over the existing endpoints with `runBulk`. Bulk delete removes drafts and cancels
 * confirmed challans (each dry-run first; one that touches a sent bill or needs a check is skipped). Bulk confirm never opens the change
 * dialog: each draft is dry-run first and confirmed only when the report is clean; the rest are
 * skipped with a reason in the "Done" dialog and stay selected.
 */
import type { ReactNode } from 'react';
import {
  useConfirmChallanMutation,
  useDeleteChallanMutation,
  useCancelChallanMutation,
  useLazyDownloadChallanPdfQuery,
} from '../../api/challanApi';
import { getErrorMessage } from '../../api/baseApi';
import { isDryRunResult } from '../../api/changeGate';
import type { GatedCall } from '../../hooks/useChangeGate';
import { Button } from '../../components/ui';
import { getApiError } from '../../utils/apiError';
import { runBulk } from '../../utils/runBulk';
import {
  plural,
  splitResults,
  useBulkOutcome,
  type ConfirmRequest,
  type RowSkip,
} from '../../components/bulk';
import type { Challan, GateReport } from '../../types';

export const CHECK_REASON = 'needs a check, open it to confirm';
export const CANCEL_CHECK_REASON = 'needs a check, open it to cancel';
export const KEPT_REASON = 'kept, not cancelled';
export const YEAR_CLOSED_REASON = 'year closed';
/** Gate refusals the change dialog would handle; in bulk they mean "open it to confirm". */
const GATE_CODES = new Set([
  'BILLED_PERIOD_LOCKED',
  'REASON_REQUIRED',
  'NEGATIVE_STOCK_CONFIRM_REQUIRED',
]);

const isClean = (r: GateReport) =>
  r.affected.length === 0 && r.negative.length === 0 && r.blocked === null && !r.requiresReason;

const notDraftReason = (c: Challan) =>
  c.status === 'cancelled' ? 'cancelled' : 'already confirmed';

function reasonFor(err: unknown, check = CHECK_REASON): string {
  if (err instanceof Skipped) return err.reason;
  const { code } = getApiError(err);
  if (code === 'YEAR_CLOSED') return YEAR_CLOSED_REASON;
  if (code && GATE_CODES.has(code)) return check;
  return getErrorMessage(err);
}

/** Thrown when the dry run reports something the change dialog would ask about. */
class Skipped extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

interface Options {
  businessId: string;
  /** The selected challans (row objects, table order). */
  challans: Challan[];
  /** Same value the single Confirm sends. */
  confirmedBy: string;
  /** Called after a run with the ids that succeeded, so they leave the selection. */
  onSucceeded: (ids: string[]) => void;
  /** Opens a confirm dialog (from the page's `useConfirm`). */
  ask: (request: ConfirmRequest) => void;
  /** The page's `useChangeGate().run`: cancels that change a bill or stock show its impact dialog. */
  runGated: (call: GatedCall, opts?: { subject?: ReactNode }) => Promise<boolean>;
}

export function useChallanBulkActions({
  businessId,
  challans,
  confirmedBy,
  onSucceeded,
  ask,
  runGated,
}: Options) {
  const [confirmChallan] = useConfirmChallanMutation();
  const [deleteChallan] = useDeleteChallanMutation();
  const [cancelChallan] = useCancelChallanMutation();
  const [downloadPdf] = useLazyDownloadChallanPdfQuery();
  const { running, guard, busy, finish, runDownloads, dialog } = useBulkOutcome<Challan>({
    rowKey: c => c._id,
    label: c => c.challanNumber,
    noun: 'challans',
    onSucceeded,
  });

  const drafts = challans.filter(c => c.status === 'draft');

  const confirmOne = async (challan: Challan) => {
    const call = (dryRun?: boolean) =>
      confirmChallan({
        businessId,
        challanId: challan._id,
        confirmedBy,
        ...(dryRun && { dryRun }),
      }).unwrap();
    const preview = await call(true);
    // Anything but a report means the server did not preview it: leave it for the single flow.
    if (!isDryRunResult(preview)) throw new Skipped(CHECK_REASON);
    const { report } = preview;
    if (report.blocked === 'closedYear') throw new Skipped(YEAR_CLOSED_REASON);
    if (!isClean(report)) throw new Skipped(CHECK_REASON);
    await call();
  };

  const runConfirm = guard(async () => {
    const order = challans;
    const skipped: Array<RowSkip<Challan>> = challans
      .filter(c => c.status !== 'draft')
      .map(row => ({ row, reason: notDraftReason(row) }));
    const results = await busy(() => runBulk(drafts, confirmOne));
    const confirmed = splitResults(results, c => c._id, reasonFor);
    finish(
      `${confirmed.done.length} confirmed`,
      confirmed.done,
      [...skipped, ...confirmed.skipped],
      order
    );
  });

  // Delete = drafts removed, confirmed challans cancelled (stock moves undone, number kept).
  const removable = challans.filter(c => c.status === 'draft' || c.status === 'confirmed');
  const confirmedCount = removable.filter(c => c.status === 'confirmed').length;
  const draftCount = removable.length - confirmedCount;

  /**
   * Cancel one confirmed challan through the change gate: a clean dry run cancels straight away;
   * one that would change a bill (draft or sent), stock or a closed year opens the impact dialog
   * for that challan. Closing the dialog keeps the challan.
   */
  const cancelOne = async (challan: Challan) => {
    const done = await runGated(
      gate => cancelChallan({ businessId, challanId: challan._id, ...gate }).unwrap(),
      { subject: `Cancelling challan ${challan.challanNumber}` }
    );
    if (!done) throw new Skipped(KEPT_REASON);
  };

  const runDelete = guard(async () => {
    const skipped: Array<RowSkip<Challan>> = challans
      .filter(c => c.status === 'cancelled')
      .map(row => ({ row, reason: 'already cancelled' }));
    // Drafts in parallel; confirmed one at a time, since each may open its own impact dialog.
    const results = await busy(async () => [
      ...(await runBulk(
        removable.filter(c => c.status === 'draft'),
        c => deleteChallan({ businessId, challanId: c._id }).unwrap()
      )),
      ...(await runBulk(
        removable.filter(c => c.status === 'confirmed'),
        cancelOne,
        { concurrency: 1 }
      )),
    ]);
    const removed = splitResults(
      results,
      c => c._id,
      err => reasonFor(err, CANCEL_CHECK_REASON)
    );
    const doneIds = new Set(removed.done);
    const deleted = removable.filter(c => doneIds.has(c._id) && c.status === 'draft').length;
    const cancelled = removed.done.length - deleted;
    const summary = [deleted > 0 && `${deleted} deleted`, cancelled > 0 && `${cancelled} cancelled`]
      .filter(Boolean)
      .join(', ');
    finish(summary || '0 deleted', removed.done, [...skipped, ...removed.skipped], challans);
  });

  const deleteBody = [
    draftCount > 0 &&
      `${draftCount} ${plural(draftCount, 'draft is', 'drafts are')} removed for good.`,
    confirmedCount > 0 &&
      `${confirmedCount} confirmed ${plural(confirmedCount, 'challan is', 'challans are')} cancelled: stock moves are undone and ${plural(confirmedCount, 'it stays', 'they stay')} in the list as Cancelled. If a cancel changes a bill or stock, you'll see which bills and confirm each one.`,
  ]
    .filter(Boolean)
    .join(' ');

  const runDownload = () =>
    runDownloads(
      challans,
      c =>
        downloadPdf({
          businessId,
          challanId: c._id,
          fileName: `challan-${c.challanNumber}.pdf`,
        }).unwrap(),
      reasonFor
    );

  const n = drafts.length;
  const actions: ReactNode = (
    <>
      <Button
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Confirm ${n} ${plural(n, 'challan', 'challans')}?`,
            body: "Each challan's stock moves are saved. Challans that need a check are skipped.",
            confirmLabel: 'Confirm',
            onConfirm: runConfirm,
          })
        }
      >
        Confirm {n}
      </Button>
      <Button
        variant="danger"
        disabled={removable.length === 0 || running}
        onClick={() =>
          ask({
            title: `Delete ${removable.length} ${plural(removable.length, 'challan', 'challans')}?`,
            body: deleteBody,
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: runDelete,
          })
        }
      >
        Delete {removable.length}
      </Button>
      <Button disabled={challans.length === 0 || running} onClick={() => runDownload()}>
        Download {challans.length} {plural(challans.length, 'PDF', 'PDFs')}
      </Button>
    </>
  );

  return { actions, dialog, running };
}
