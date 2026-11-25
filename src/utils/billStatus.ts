import type { Bill } from '../types';

type BillStatus = Bill['status'];

/** Issued = anything but a draft or a cancelled bill. Issued bills are never edited or deleted. */
export function isIssued(bill: Pick<Bill, 'status'>): boolean {
  return bill.status !== 'draft' && bill.status !== 'cancelled';
}

const ISSUED_STATUSES: BillStatus[] = ['sent', 'partial', 'paid', 'overdue'];

/**
 * Mirrors the backend `assertStatusTransition`: draft -> sent | cancelled, any move among
 * sent/partial/paid/overdue, nothing back to draft and an issued bill is never cancelled.
 */
export function canChangeStatus(from: BillStatus, to: BillStatus): boolean {
  if (from === to) return false;
  if (from === 'draft') return to === 'sent' || to === 'cancelled';
  return ISSUED_STATUSES.includes(from) && ISSUED_STATUSES.includes(to);
}
