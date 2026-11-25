import { describe, expect, it } from 'vitest';
import { balanceDue, effectiveAmount, manualNoteTotals, noteSign, signedMoney } from './billMoney';

describe('billMoney', () => {
  it('signs money: plus for positive, minus for negative, none for zero', () => {
    expect(signedMoney(500)).toBe('+₹500');
    expect(signedMoney(-1000)).toBe('-₹1,000');
    expect(signedMoney(0)).toBe('₹0');
  });

  it('effectiveAmount adds the signed notes total to the bill total', () => {
    expect(effectiveAmount({ totalAmount: 1000, notesTotal: -250 })).toBe(750);
    expect(effectiveAmount({ totalAmount: 1000, notesTotal: 120.5 })).toBe(1120.5);
  });

  it('treats a missing notesTotal as zero and rounds to 2 decimals', () => {
    expect(effectiveAmount({ totalAmount: 1000 })).toBe(1000);
    expect(effectiveAmount({ totalAmount: 0.1, notesTotal: 0.2 })).toBe(0.3);
  });

  it('balanceDue is effective amount minus paid, negative when over-credited', () => {
    expect(balanceDue({ totalAmount: 1000, notesTotal: 200, amountPaid: 500 })).toBe(700);
    expect(balanceDue({ totalAmount: 1000, amountPaid: 0 })).toBe(1000);
    expect(balanceDue({ totalAmount: 1000, notesTotal: -400, amountPaid: 1000 })).toBe(-400);
  });

  it('manualNoteTotals taxes the line sum with the bill intra rates and no discount', () => {
    const t = manualNoteTotals([{ amount: 100.5 }, { amount: 99.5 }], {
      taxMode: 'intra',
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 0,
    });
    expect(t).toEqual({
      subtotal: 200,
      sgstAmount: 18,
      cgstAmount: 18,
      igstAmount: 0,
      taxAmount: 36,
      totalAmount: 236,
    });
  });

  it('manualNoteTotals uses IGST only for inter bills', () => {
    const t = manualNoteTotals([{ amount: 1000 }], {
      taxMode: 'inter',
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 18,
    });
    expect(t).toMatchObject({ sgstAmount: 0, cgstAmount: 0, igstAmount: 180, totalAmount: 1180 });
  });

  it('manualNoteTotals splits a legacy single tax rate like the backend', () => {
    expect(manualNoteTotals([{ amount: 100 }], { taxRate: 18 })).toMatchObject({
      sgstAmount: 9,
      cgstAmount: 9,
      totalAmount: 118,
    });
    expect(manualNoteTotals([{ amount: 100 }], { taxMode: 'inter', taxRate: 12 })).toMatchObject({
      igstAmount: 12,
      totalAmount: 112,
    });
  });

  it('manualNoteTotals ignores lines that are not numbers yet', () => {
    expect(manualNoteTotals([{ amount: Number.NaN }, { amount: 50 }], {}).totalAmount).toBe(50);
  });

  it('noteSign is -1 for credit notes and 1 for debit notes', () => {
    expect(noteSign('credit')).toBe(-1);
    expect(noteSign('debit')).toBe(1);
  });
});
