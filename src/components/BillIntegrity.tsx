/**
 * @fileoverview Shared pieces for the out-of-date, pending adjustment and
 * negative stock states of a bill (detail page notices and send dialogs).
 */
import { Button, Notice } from './ui';
import { isIssued } from '../utils/billStatus';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, BillChangeCause, NegativeSpan } from '../types';
import styles from './BillIntegrity.module.css';

/** Money with its sign always shown (`+₹500`, `-₹500`). */
function signedMoney(n: number): string {
  return `${n > 0 ? '+' : ''}${formatMoney(n)}`;
}

export function CauseList({ causes }: { causes: BillChangeCause[] }) {
  if (causes.length === 0) return null;
  return (
    <ul className={styles.list}>
      {causes.map(c => (
        <li key={`${c.kind}-${c.id}-${c.at}`}>
          {c.label}
          {c.reason ? `: ${c.reason}` : ''} ({formatDate(c.at)})
        </li>
      ))}
    </ul>
  );
}

export function NegativeStockList({ spans }: { spans: NegativeSpan[] }) {
  return (
    <ul className={styles.list}>
      {spans.map(s => (
        <li key={`${s.itemId}-${s.from}`}>
          {s.itemName}:{' '}
          {s.from === s.to ? formatDate(s.from) : `${formatDate(s.from)} – ${formatDate(s.to)}`},
          lowest count {s.minQty}
        </li>
      ))}
    </ul>
  );
}

interface NoticesProps {
  bill: Bill;
  onRefresh: () => void;
  refreshing: boolean;
  refreshError: string | null;
}

/** The integrity notices at the top of a bill: out of date, pending adjustment, negative stock. */
export function BillIntegrityNotices({ bill, onRefresh, refreshing, refreshError }: NoticesProps) {
  const issued = isIssued(bill);
  const showDrift = bill.drift != null && !issued;
  const showPending = bill.pendingAdjustment != null && issued;
  const negative = bill.negativeStock ?? [];
  return (
    <>
      {showDrift && bill.drift && (
        <Notice tone="warning" title="Out of date">
          <div className={styles.row}>
            <p className={styles.text}>
              The total changes by {signedMoney(bill.drift.delta.total)} since this bill was made.
            </p>
            <Button variant="primary" onClick={onRefresh} loading={refreshing}>
              Refresh bill
            </Button>
          </div>
          <CauseList causes={bill.drift.causes} />
          {refreshError && <p className={styles.error}>{refreshError}</p>}
        </Notice>
      )}
      {showPending && bill.pendingAdjustment && (
        <Notice
          tone="info"
          title={`Pending adjustment ${signedMoney(bill.pendingAdjustment.amount)}`}
        >
          <p className={styles.text}>
            A credit or debit note for this amount comes in the next release.
          </p>
          <CauseList causes={bill.pendingAdjustment.causes} />
        </Notice>
      )}
      {negative.length > 0 && (
        <Notice tone="warning" title="Stock went below zero">
          <p className={styles.text}>These items were billed as 0 on these days.</p>
          <NegativeStockList spans={negative} />
        </Notice>
      )}
    </>
  );
}
