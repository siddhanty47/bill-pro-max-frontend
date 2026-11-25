import type { Bill } from '../types';

type MoneyBill = Pick<Bill, 'totalAmount'> & Partial<Pick<Bill, 'notesTotal' | 'amountPaid'>>;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Mirrors the backend `effectiveAmount`: the bill's frozen total plus the signed total of its
 * issued notes (debits add, credits subtract).
 */
export function effectiveAmount(bill: MoneyBill): number {
  return round2(bill.totalAmount + (bill.notesTotal ?? 0));
}

/** Mirrors the backend `balanceDueOf`: effective amount minus paid (negative = over-credited). */
export function balanceDue(bill: MoneyBill): number {
  return round2(effectiveAmount(bill) - (bill.amountPaid ?? 0));
}
