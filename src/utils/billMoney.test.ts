import { describe, expect, it } from 'vitest';
import { balanceDue, effectiveAmount } from './billMoney';

describe('billMoney', () => {
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
});
