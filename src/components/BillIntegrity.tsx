/**
 * @fileoverview Shared pieces for the out-of-date, draft note (or legacy pending adjustment) and
 * negative stock states of a bill (detail page notices and send dialogs).
 */
import { Button, Notice } from './ui';
import { isIssued } from '../utils/billStatus';
import { formatDate, formatMoney } from '../utils/format';
import { signedMoney } from '../utils/billMoney';
import type { Bill, BillChangeCause, BillNote, NegativeSpan } from '../types';
import styles from './BillIntegrity.module.css';

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

/** A below-zero span; `to` and `firstCause` (the challan that caused it) are optional. */
export type NegativeStockSpan = Pick<NegativeSpan, 'itemId' | 'itemName' | 'from' | 'minQty'> & {
  to?: string;
  firstCause?: string;
};

function spanLabel(s: NegativeStockSpan): string {
  if (s.to == null) return `from ${formatDate(s.from)}`;
  return s.from === s.to ? formatDate(s.from) : `${formatDate(s.from)} – ${formatDate(s.to)}`;
}

export function NegativeStockList({ spans }: { spans: NegativeStockSpan[] }) {
  return (
    <ul className={styles.list}>
      {spans.map(s => (
        <li key={`${s.itemId}-${s.from}`}>
          {s.itemName}: {spanLabel(s)}, lowest count {s.minQty}
          {s.firstCause ? ` (challan ${s.firstCause})` : ''}
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
  /** The issued bill's draft auto note (its drift correction), if there is one */
  draftNote?: BillNote | null;
}

/**
 * The integrity notices at the top of a bill: out of date (drafts), the draft auto note (issued
 * bills; a legacy `pendingAdjustment` without a draft note keeps its old card), negative stock.
 */
export function BillIntegrityNotices({
  bill,
  onRefresh,
  refreshing,
  refreshError,
  draftNote,
}: NoticesProps) {
  const issued = isIssued(bill);
  const showDrift = bill.drift != null && !issued;
  const showDraftNote = issued && draftNote != null;
  const showPending = bill.pendingAdjustment != null && issued && !showDraftNote;
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
      {showDraftNote && draftNote && (
        <Notice
          tone="info"
          title={`Draft ${draftNote.type} note ${formatMoney(draftNote.totalAmount)}`}
        >
          <div className={styles.row}>
            <CauseList causes={draftNote.causes} />
            <Button size="sm" to={`/bill-notes/${draftNote._id}`}>
              Review
            </Button>
          </div>
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
