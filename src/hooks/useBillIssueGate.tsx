/**
 * @fileoverview Guards sending a draft bill: an out-of-date bill is blocked with a
 * Refresh button, and negative stock needs a confirmation before it goes out.
 * The server stays the source of truth: its 409s open the same dialogs.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { useRefreshBillMutation } from '../api/billApi';
import { getErrorMessage } from '../api/baseApi';
import { getApiError, hasApiErrorCode } from '../utils/apiError';
import { Button, Modal } from '../components/ui';
import { NegativeStockList } from '../components/BillIntegrity';
import type { Bill, NegativeSpan } from '../types';
import styles from '../components/BillIntegrity.module.css';

export const OUT_OF_DATE_MESSAGE =
  'This bill is out of date. Refresh it before sending, so it shows the right total.';

type Run = (acknowledgeNegative?: boolean) => Promise<unknown>;

type Pending =
  | { kind: 'outOfDate'; bill: Bill; message: string }
  | { kind: 'negative'; bill: Bill; run: Run; spans: NegativeSpan[] };

export function useBillIssueGate(businessId: string | null | undefined) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshMutation, { isLoading: refreshing }] = useRefreshBillMutation();

  /** Re-price a draft bill. Returns true on success; the message is in `refreshError`. */
  const refresh = useCallback(
    async (bill: Bill): Promise<boolean> => {
      if (!businessId) return false;
      setRefreshError(null);
      try {
        await refreshMutation({ businessId, billId: bill._id }).unwrap();
        return true;
      } catch (err) {
        setRefreshError(
          hasApiErrorCode(err, 'BILL_PERIOD_EMPTY')
            ? (getApiError(err).message ?? getErrorMessage(err))
            : getErrorMessage(err)
        );
        return false;
      }
    },
    [businessId, refreshMutation]
  );

  const execute = useCallback(async (bill: Bill, run: Run, ack?: boolean) => {
    try {
      await run(ack);
      setPending(null);
    } catch (err) {
      const info = getApiError(err);
      if (info.code === 'BILL_OUT_OF_DATE') {
        setPending({
          kind: 'outOfDate',
          bill,
          message: info.message ?? OUT_OF_DATE_MESSAGE,
        });
      } else if (info.code === 'NEGATIVE_STOCK_ACK_REQUIRED') {
        const spans = info.details?.negativeStock;
        setPending({
          kind: 'negative',
          bill,
          run,
          spans: Array.isArray(spans) ? (spans as NegativeSpan[]) : [],
        });
      } else {
        setPending(null);
        alert(getErrorMessage(err));
      }
    }
  }, []);

  /**
   * Send a bill. `run` makes the API call with the acknowledge flag. Drafts that are
   * out of date never reach the API; drafts with negative stock ask first.
   * `issuing` is false for actions that do not issue the bill (e.g. cancelling).
   */
  const attempt = useCallback(
    async (bill: Bill, run: Run, issuing = bill.status === 'draft') => {
      if (issuing) {
        if (bill.drift != null) {
          setRefreshError(null);
          setPending({ kind: 'outOfDate', bill, message: OUT_OF_DATE_MESSAGE });
          return;
        }
        if (bill.negativeStock && bill.negativeStock.length > 0) {
          setPending({ kind: 'negative', bill, run, spans: bill.negativeStock });
          return;
        }
      }
      await execute(bill, run);
    },
    [execute]
  );

  const close = () => setPending(null);

  let dialog: ReactNode = null;
  if (pending?.kind === 'outOfDate') {
    const { bill, message } = pending;
    dialog = (
      <Modal isOpen onClose={close} title="Bill is out of date">
        <p>{message}</p>
        {refreshError && <p>{refreshError}</p>}
        <div className={styles.actions}>
          <Button onClick={close}>Close</Button>
          <Button
            variant="primary"
            loading={refreshing}
            onClick={async () => {
              if (await refresh(bill)) close();
            }}
          >
            Refresh bill
          </Button>
        </div>
      </Modal>
    );
  } else if (pending?.kind === 'negative') {
    const { bill, run, spans } = pending;
    dialog = (
      <Modal isOpen onClose={close} title="Stock went below zero">
        <p>These items were billed as 0 on these days. Send the bill anyway?</p>
        <NegativeStockList spans={spans} />
        <div className={styles.actions}>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await execute(bill, run, true);
              setBusy(false);
            }}
          >
            Send anyway
          </Button>
        </div>
      </Modal>
    );
  }

  return { attempt, refresh, refreshing, refreshError, dialog };
}
