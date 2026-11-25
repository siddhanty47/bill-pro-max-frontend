import type { Bill, BillNoteType } from '../types';

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

/** Display sign of a note's stored (positive) amounts: credits read as negative. */
export function noteSign(type: BillNoteType): 1 | -1 {
  return type === 'credit' ? -1 : 1;
}

/** The bill fields a manual note's tax comes from (the bill's own rates, never current settings) */
export type NoteTaxRates = Partial<
  Pick<Bill, 'taxMode' | 'taxRate' | 'sgstRate' | 'cgstRate' | 'igstRate'>
>;

export interface NoteTotals {
  subtotal: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Preview of a manual note's totals, mirroring the backend `manualNoteAmounts` with
 * `BillingService.settingsOf(bill)`: subtotal = Σ lines, tax at the bill's rates, no discount.
 * Positive, in the note's direction. The server's figures are the ones saved.
 */
export function manualNoteTotals(lines: Array<{ amount: number }>, bill: NoteTaxRates): NoteTotals {
  const taxMode = bill.taxMode ?? 'intra';
  let sgstRate = bill.sgstRate ?? 0;
  let cgstRate = bill.cgstRate ?? 0;
  let igstRate = bill.igstRate ?? 0;
  const legacyRate = bill.taxRate ?? 0;
  if (sgstRate === 0 && cgstRate === 0 && igstRate === 0 && legacyRate > 0) {
    if (taxMode === 'intra') {
      sgstRate = legacyRate / 2;
      cgstRate = legacyRate / 2;
    } else {
      igstRate = legacyRate;
    }
  }
  if (taxMode === 'intra') igstRate = 0;
  else {
    sgstRate = 0;
    cgstRate = 0;
  }
  const subtotal = round2(
    lines.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? round2(l.amount) : 0), 0)
  );
  const sgstAmount = round2((subtotal * sgstRate) / 100);
  const cgstAmount = round2((subtotal * cgstRate) / 100);
  const igstAmount = round2((subtotal * igstRate) / 100);
  const taxAmount = round2(sgstAmount + cgstAmount + igstAmount);
  return {
    subtotal,
    sgstAmount,
    cgstAmount,
    igstAmount,
    taxAmount,
    totalAmount: round2(subtotal + taxAmount),
  };
}
