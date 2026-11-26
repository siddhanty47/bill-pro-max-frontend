/**
 * @fileoverview Bulk actions for the Challans table: confirm drafts and download PDFs, run per
 * challan over the existing endpoints with `runBulk`. Bulk confirm never opens the change
 * dialog: each draft is dry-run first and confirmed only when the report is clean; the rest are
 * skipped with a reason in the "Done" dialog and stay selected.
 */
import { useState, type ReactNode } from 'react';
import { useConfirmChallanMutation, useLazyDownloadChallanPdfQuery } from '../../api/challanApi';
import { getErrorMessage } from '../../api/baseApi';
import { isDryRunResult } from '../../api/changeGate';
import { Button } from '../../components/ui';
import { getApiError } from '../../utils/apiError';
import { runBulk } from '../../utils/runBulk';
import { BulkResultDialog, useInFlightGuard, type ConfirmRequest } from '../../components/bulk';
import type { Challan, GateReport } from '../../types';

export const CHECK_REASON = 'needs a check, open it to confirm';
export const YEAR_CLOSED_REASON = 'year closed';
/** Gate refusals the change dialog would handle; in bulk they mean "open it to confirm". */
const GATE_CODES = new Set([
  'BILLED_PERIOD_LOCKED',
  'REASON_REQUIRED',
  'NEGATIVE_STOCK_CONFIRM_REQUIRED',
]);

type Skip = { challan: Challan; reason: string };
type Outcome = { line: string; skipped: Skip[] };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const isClean = (r: GateReport) =>
  r.affected.length === 0 && r.negative.length === 0 && r.blocked === null && !r.requiresReason;

const notDraftReason = (c: Challan) =>
  c.status === 'cancelled' ? 'cancelled' : 'already confirmed';

function reasonFor(err: unknown): string {
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
  const [downloadPdf] = useLazyDownloadChallanPdfQuery();
  const [running, setRunning] = useState(false);
  const guard = useInFlightGuard();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const drafts = challans.filter(c => c.status === 'draft');

  const finish = (line: string, done: string[], skipped: Skip[], order: Challan[]) => {
    const position = new Map(order.map((c, i) => [c._id, i]));
    const at = (s: Skip) => position.get(s.challan._id) ?? order.length;
    onSucceeded(done);
    setOutcome({ line, skipped: [...skipped].sort((a, b) => at(a) - at(b)) });
  };

  const confirmOne = async (challan: Challan) => {
    const call = (dryRun?: boolean) =>
      confirmChallan({
        businessId,
        challanId: challan._id,
        confirmedBy,
        ...(dryRun && { dryRun }),
      }).unwrap();
    const preview = await call(true);
    if (!isDryRunResult(preview)) return;
    const { report } = preview;
    if (report.blocked === 'closedYear') throw new Skipped(YEAR_CLOSED_REASON);
    if (!isClean(report)) throw new Skipped(CHECK_REASON);
    await call();
  };

  const runConfirm = guard(async () => {
    const order = challans;
    const skipped: Skip[] = challans
      .filter(c => c.status !== 'draft')
      .map(challan => ({ challan, reason: notDraftReason(challan) }));
    setRunning(true);
    const results = await runBulk(drafts, confirmOne);
    setRunning(false);
    const done: string[] = [];
    for (const r of results) {
      if (r.ok) done.push(r.item._id);
      else
        skipped.push({
          challan: r.item,
          reason: r.error instanceof Skipped ? r.error.reason : reasonFor(r.error),
        });
    }
    finish(`${done.length} confirmed`, done, skipped, order);
  });

  const runDownload = guard(async () => {
    const order = challans;
    setRunning(true);
    const results = await runBulk(
      challans,
      c =>
        downloadPdf({
          businessId,
          challanId: c._id,
          fileName: `challan-${c.challanNumber}.pdf`,
        }).unwrap(),
      { concurrency: 2 }
    );
    setRunning(false);
    const done = results.filter(r => r.ok).map(r => r.item._id);
    const skipped = results.flatMap(r =>
      r.ok ? [] : [{ challan: r.item, reason: reasonFor(r.error) }]
    );
    finish(`${done.length} downloaded`, done, skipped, order);
  });

  const n = drafts.length;
  const actions: ReactNode = (
    <>
      <Button
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Confirm ${n} ${plural(n, 'challan', 'challans')}?`,
            confirmLabel: 'Confirm',
            onConfirm: runConfirm,
          })
        }
      >
        Confirm {n}
      </Button>
      <Button disabled={challans.length === 0 || running} onClick={() => runDownload()}>
        Download {challans.length} {plural(challans.length, 'PDF', 'PDFs')}
      </Button>
    </>
  );

  const dialog: ReactNode = outcome ? (
    <BulkResultDialog
      lines={[outcome.line]}
      skipped={outcome.skipped.map(({ challan, reason }) => ({
        label: challan.challanNumber,
        reason,
      }))}
      noun="challans"
      onClose={() => setOutcome(null)}
    />
  ) : null;

  return { actions, dialog, running };
}
