/**
 * @fileoverview Bulk actions for the Bills table: mark as sent, send to client, download PDFs
 * and delete, run per bill over the existing endpoints with `runBulk`. Each action runs on the
 * bills it applies to; the others, and every failure, are listed as skipped in a "Done" dialog.
 */
import { useState, type ReactNode } from 'react';
import {
  useDeleteBillMutation,
  useLazyDownloadBillPdfQuery,
  useSendBillEmailMutation,
  useUpdateBillStatusMutation,
} from '../../api/billApi';
import { getErrorMessage } from '../../api/baseApi';
import { Button, Modal } from '../../components/ui';
import { NegativeStockList, type NegativeStockSpan } from '../../components/BillIntegrity';
import { getApiError } from '../../utils/apiError';
import { isIssued } from '../../utils/billStatus';
import { runBulk } from '../../utils/runBulk';
import type { Bill } from '../../types';
import type { ConfirmRequest } from './BillConfirmDialog';
import styles from './BillDialogs.module.css';

export const OUT_OF_DATE_REASON = 'out of date, open it and press Refresh';
export const NEGATIVE_DECLINED_REASON = 'stock below zero, not sent';

type Skip = { bill: Bill; reason: string };
type Outcome = { line: string; skipped: Skip[] };
type NegativeBill = { bill: Bill; spans: NegativeStockSpan[] };
type IssueKind = 'markSent' | 'email';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Bills that are not drafts can't be sent again. */
const notDraftReason = (bill: Bill) => (bill.status === 'cancelled' ? 'cancelled' : 'already sent');

function reasonFor(err: unknown): string {
  if (getApiError(err).code === 'BILL_OUT_OF_DATE') return OUT_OF_DATE_REASON;
  return getErrorMessage(err);
}

interface Options {
  businessId: string;
  /** The selected bills (row objects). */
  bills: Bill[];
  /** Called after a run with the ids that succeeded, so they leave the selection. */
  onSucceeded: (ids: string[]) => void;
  /** Opens a confirm dialog (from the page's `useConfirm`). */
  ask: (request: ConfirmRequest) => void;
}

export function useBillBulkActions({ businessId, bills, onSucceeded, ask }: Options) {
  const [updateBillStatus] = useUpdateBillStatusMutation();
  const [sendBillEmail] = useSendBillEmailMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [downloadPdf] = useLazyDownloadBillPdfQuery();

  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [negative, setNegative] = useState<{
    kind: IssueKind;
    items: NegativeBill[];
    done: string[];
    skipped: Skip[];
  } | null>(null);

  const drafts = bills.filter(b => b.status === 'draft');
  const removable = bills.filter(b => !isIssued(b));

  const finish = (line: string, done: string[], skipped: Skip[]) => {
    onSucceeded(done);
    setOutcome({ line, skipped });
  };

  const issueOne = (kind: IssueKind, bill: Bill, acknowledgeNegative?: boolean) =>
    kind === 'markSent'
      ? updateBillStatus({
          businessId,
          billId: bill._id,
          status: 'sent',
          acknowledgeNegative,
        }).unwrap()
      : sendBillEmail({ businessId, billId: bill._id, acknowledgeNegative }).unwrap();

  const issueLine = (kind: IssueKind, n: number) =>
    kind === 'markSent' ? `${n} marked as sent` : `${n} sent`;

  /** First pass without the acknowledge flag; bills with negative stock are asked about together. */
  const runIssue = async (kind: IssueKind) => {
    const skipped: Skip[] = bills
      .filter(b => b.status !== 'draft')
      .map(bill => ({ bill, reason: notDraftReason(bill) }));
    // Out-of-date drafts never reach the API (same rule as the single-bill gate).
    const ready = drafts.filter(b => {
      if (b.drift == null) return true;
      skipped.push({ bill: b, reason: OUT_OF_DATE_REASON });
      return false;
    });
    setRunning(true);
    const results = await runBulk(ready, bill => issueOne(kind, bill));
    setRunning(false);
    const done: string[] = [];
    const needAck: NegativeBill[] = [];
    for (const r of results) {
      if (r.ok) {
        done.push(r.item._id);
        continue;
      }
      const info = getApiError(r.error);
      if (info.code === 'NEGATIVE_STOCK_ACK_REQUIRED') {
        const spans = info.details?.negativeStock;
        needAck.push({
          bill: r.item,
          spans: Array.isArray(spans)
            ? (spans as NegativeStockSpan[])
            : (r.item.negativeStock ?? []),
        });
      } else {
        skipped.push({ bill: r.item, reason: reasonFor(r.error) });
      }
    }
    if (needAck.length > 0) setNegative({ kind, items: needAck, done, skipped });
    else finish(issueLine(kind, done.length), done, skipped);
  };

  const declineNegative = () => {
    if (!negative) return;
    const { kind, items, done, skipped } = negative;
    setNegative(null);
    finish(issueLine(kind, done.length), done, [
      ...skipped,
      ...items.map(({ bill }) => ({ bill, reason: NEGATIVE_DECLINED_REASON })),
    ]);
  };

  const sendAnyway = async () => {
    if (!negative) return;
    const { kind, items, done, skipped } = negative;
    setRunning(true);
    const results = await runBulk(
      items.map(i => i.bill),
      bill => issueOne(kind, bill, true)
    );
    setRunning(false);
    setNegative(null);
    const allDone = [...done];
    const allSkipped = [...skipped];
    for (const r of results) {
      if (r.ok) allDone.push(r.item._id);
      else allSkipped.push({ bill: r.item, reason: reasonFor(r.error) });
    }
    finish(issueLine(kind, allDone.length), allDone, allSkipped);
  };

  const runDownload = async () => {
    setRunning(true);
    const results = await runBulk(
      bills,
      bill =>
        downloadPdf({
          businessId,
          billId: bill._id,
          fileName: `invoice-${bill.billNumber}.pdf`,
        }).unwrap(),
      { concurrency: 2 }
    );
    setRunning(false);
    const done = results.filter(r => r.ok).map(r => r.item._id);
    const skipped = results.flatMap(r =>
      r.ok ? [] : [{ bill: r.item, reason: reasonFor(r.error) }]
    );
    finish(`${done.length} downloaded`, done, skipped);
  };

  const runDelete = async () => {
    const skipped: Skip[] = bills
      .filter(isIssued)
      .map(bill => ({ bill, reason: "can't delete a sent bill" }));
    setRunning(true);
    const results = await runBulk(removable, bill =>
      deleteBill({ businessId, billId: bill._id }).unwrap()
    );
    setRunning(false);
    const done: string[] = [];
    for (const r of results) {
      if (r.ok) done.push(r.item._id);
      else skipped.push({ bill: r.item, reason: reasonFor(r.error) });
    }
    finish(`${done.length} deleted`, done, skipped);
  };

  const n = drafts.length;
  const actions: ReactNode = (
    <>
      <Button
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: `Mark ${n} ${plural(n, 'bill', 'bills')} as sent?`,
            body:
              n === 1
                ? 'It will be locked. No email is sent.'
                : 'They will be locked. No emails are sent.',
            confirmLabel: 'Mark as sent',
            onConfirm: () => runIssue('markSent'),
          })
        }
      >
        Mark {n} as sent
      </Button>
      <Button
        disabled={n === 0 || running}
        onClick={() =>
          ask({
            title: n === 1 ? 'Email 1 bill to its client?' : `Email ${n} bills to their clients?`,
            confirmLabel: 'Send',
            onConfirm: () => runIssue('email'),
          })
        }
      >
        Send {n} to {plural(n, 'client', 'clients')}
      </Button>
      <Button disabled={bills.length === 0 || running} onClick={runDownload}>
        Download {bills.length} {plural(bills.length, 'PDF', 'PDFs')}
      </Button>
      <Button
        variant="danger"
        disabled={removable.length === 0 || running}
        onClick={() =>
          ask({
            title: `Delete ${removable.length} ${plural(removable.length, 'bill', 'bills')}?`,
            body: "This can't be undone.",
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: runDelete,
          })
        }
      >
        Delete {removable.length}
      </Button>
    </>
  );

  let dialog: ReactNode = null;
  if (negative) {
    const k = negative.items.length;
    dialog = (
      <Modal
        isOpen
        onClose={running ? () => {} : declineNegative}
        title={`${k} ${plural(k, 'bill shows', 'bills show')} stock below zero`}
      >
        <p className={styles.text}>These items were billed as 0 on these days.</p>
        {negative.items.map(({ bill, spans }) => (
          <div key={bill._id} className={`${styles.section} ${styles.billGroup}`}>
            <strong className="mono">{bill.billNumber}</strong>
            {spans.length > 0 && <NegativeStockList spans={spans} />}
          </div>
        ))}
        <div className={styles.actions}>
          <Button onClick={declineNegative} disabled={running}>
            Cancel
          </Button>
          <Button variant="primary" loading={running} onClick={sendAnyway}>
            Send anyway
          </Button>
        </div>
      </Modal>
    );
  } else if (outcome) {
    const close = () => setOutcome(null);
    dialog = (
      <Modal isOpen onClose={close} title="Done">
        <p className={styles.text}>{outcome.line}</p>
        {outcome.skipped.length > 0 && (
          <div className={styles.section}>
            <p className={styles.text}>Skipped ({outcome.skipped.length})</p>
            <ul className={styles.list} aria-label="Skipped bills">
              {outcome.skipped.map(({ bill, reason }) => (
                <li key={bill._id}>
                  <span className="mono">{bill.billNumber}</span>: {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="primary" onClick={close}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return { actions, dialog, running };
}
