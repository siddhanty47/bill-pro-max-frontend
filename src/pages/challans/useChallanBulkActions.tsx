/**
 * @fileoverview Bulk actions for the Challans table: confirm drafts and download PDFs, run per
 * challan over the existing endpoints with `runBulk`. Bulk delete removes drafts only; confirmed
 * challans are skipped (cancel them one by one from their page). Bulk confirm never opens the change
 * dialog: each draft is dry-run first and confirmed only when the report is clean; the rest are
 * skipped with a reason in the "Done" dialog and stay selected.
 */
import type { ReactNode } from 'react';
import {
  useConfirmChallanMutation,
  useDeleteChallanMutation,
  useLazyDownloadChallanPdfQuery,
} from '../../api/challanApi';
import { getErrorMessage } from '../../api/baseApi';
import { isDryRunResult } from '../../api/changeGate';
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

function reasonFor(err: unknown): string {
  if (err instanceof Skipped) return err.reason;
  const { code } = getApiError(err);
  if (code === 'YEAR_CLOSED') return YEAR_CLOSED_REASON;
  if (code && GATE_CODES.has(code)) return CHECK_REASON;
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
}

export function useChallanBulkActions({
  businessId,
  challans,
  confirmedBy,
  onSucceeded,
  ask,
}: Options) {
  const [confirmChallan] = useConfirmChallanMutation();
  const [deleteChallan] = useDeleteChallanMutation();
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

  const runDelete = guard(async () => {
    const skipped: Array<RowSkip<Challan>> = challans
      .filter(c => c.status !== 'draft')
      .map(row => ({
        row,
        reason: row.status === 'cancelled' ? 'cancelled' : 'confirmed, open it to cancel',
      }));
    const results = await busy(() =>
      runBulk(drafts, c => deleteChallan({ businessId, challanId: c._id }).unwrap())
    );
    const deleted = splitResults(results, c => c._id, reasonFor);
    finish(
      `${deleted.done.length} deleted`,
      deleted.done,
      [...skipped, ...deleted.skipped],
      challans
    );
  });

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
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Delete ${n} draft ${plural(n, 'challan', 'challans')}?`,
            body: 'Drafts are removed for good. Confirmed challans are skipped.',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: runDelete,
          })
        }
      >
        Delete {n}
      </Button>
      <Button disabled={challans.length === 0 || running} onClick={() => runDownload()}>
        Download {challans.length} {plural(challans.length, 'PDF', 'PDFs')}
      </Button>
    </>
  );

  return { actions, dialog, running };
}
