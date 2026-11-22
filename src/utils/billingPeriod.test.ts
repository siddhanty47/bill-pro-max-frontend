import { describe, expect, it } from 'vitest';
import { isBillableAgreement, monthEndOf, periodProblem } from './billingPeriod';

describe('monthEndOf', () => {
  it('gives the last day of the start date month', () => {
    expect(monthEndOf('2026-06-01')).toBe('2026-06-30');
    expect(monthEndOf('2026-02-10')).toBe('2026-02-28');
    expect(monthEndOf('2026-12-15')).toBe('2026-12-31');
  });

  it('returns nothing for a partial date', () => {
    expect(monthEndOf('2026-06')).toBeUndefined();
  });
});

describe('periodProblem', () => {
  it('flags an end before the start as an error', () => {
    expect(periodProblem('2026-06-10', '2026-06-01')).toEqual({
      level: 'error',
      message: 'End date must be on or after the start',
    });
  });

  it('warns when the period runs past the end of its month', () => {
    expect(periodProblem('2026-06-01', '2026-11-30')).toEqual({
      level: 'warning',
      message: 'This period covers 6 months (Jun to Nov). Bills are usually one month.',
    });
  });

  it('is fine for one month', () => {
    expect(periodProblem('2026-06-01', '2026-06-30')).toBeUndefined();
  });
});

describe('isBillableAgreement', () => {
  it('allows active agreements and ones closed by a rate change', () => {
    expect(isBillableAgreement({ status: 'active' })).toBe(true);
    expect(isBillableAgreement({ status: 'expired', nextAgreementId: 'AG-2' })).toBe(true);
    expect(isBillableAgreement({ status: 'expired' })).toBe(false);
    expect(isBillableAgreement({ status: 'terminated' })).toBe(false);
  });
});
