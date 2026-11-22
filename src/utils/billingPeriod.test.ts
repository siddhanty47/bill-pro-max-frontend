import { describe, expect, it } from 'vitest';
import { inAgreementPeriod, isBillableAgreement, monthEndOf, periodProblem } from './billingPeriod';

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

describe('inAgreementPeriod', () => {
  const old = {
    status: 'expired' as const,
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-08-31T00:00:00.000Z',
    nextAgreementId: 'B',
  };
  const next = {
    status: 'active' as const,
    startDate: '2026-09-01T00:00:00.000Z',
    previousAgreementId: 'A',
  };

  it('splits a site at the rate change date', () => {
    expect(inAgreementPeriod('2026-08-31T00:00:00.000Z', old)).toBe(true);
    expect(inAgreementPeriod('2026-09-01T00:00:00.000Z', old)).toBe(false);
    expect(inAgreementPeriod('2026-09-01T00:00:00.000Z', next)).toBe(true);
    expect(inAgreementPeriod('2026-08-31T00:00:00.000Z', next)).toBe(false);
  });

  it('keeps every challan of an agreement that never changed rates', () => {
    const only = {
      status: 'active' as const,
      startDate: '2026-11-10T00:00:00.000Z',
      endDate: '2026-10-31T00:00:00.000Z',
    };
    expect(inAgreementPeriod('2026-04-02T00:00:00.000Z', only)).toBe(true);
    expect(inAgreementPeriod('2026-11-20T00:00:00.000Z', only)).toBe(true);
  });
});
