import type { Bill } from '../types';

/** Issued = anything but a draft or a cancelled bill. Issued bills are never edited or deleted. */
export function isIssued(bill: Pick<Bill, 'status'>): boolean {
  return bill.status !== 'draft' && bill.status !== 'cancelled';
}
