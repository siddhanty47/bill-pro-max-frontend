import { describe, expect, it } from 'vitest';
import { creditNoteDeadline, fyEnd, fyOf, isPastCreditDeadline } from './financialYear';

const d = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

describe('fyOf', () => {
  it('reads the IST day', () => {
    expect(fyOf(d('2026-03-31'))).toBe('2025-26');
    expect(fyOf(d('2026-04-01'))).toBe('2026-27');
    expect(fyOf(new Date('2026-03-31T20:00:00Z'))).toBe('2026-27');
    expect(fyOf(new Date('2026-03-31T18:29:59Z'))).toBe('2025-26');
    expect(fyOf(new Date('2026-03-31T18:30:00Z'))).toBe('2026-27');
  });
  it('rolls the century label', () => {
    expect(fyOf(d('2099-05-01'))).toBe('2099-00');
  });
});

describe('fyEnd', () => {
  it('is 31 March, UTC midnight', () => {
    expect(fyEnd('2025-26')).toEqual(d('2026-03-31'));
  });
});

describe('creditNoteDeadline', () => {
  it('defaults to 30 Nov after the FY end', () => {
    expect(creditNoteDeadline('2025-26')).toEqual(d('2026-11-30'));
  });
  it('falls back to 11-30 on a malformed or impossible setting', () => {
    expect(creditNoteDeadline('2025-26', 'bad')).toEqual(d('2026-11-30'));
    expect(creditNoteDeadline('2025-26', '02-30')).toEqual(d('2026-11-30'));
    expect(creditNoteDeadline('2025-26', '13-01')).toEqual(d('2026-11-30'));
  });
  it('honours a custom MM-DD', () => {
    expect(creditNoteDeadline('2025-26', '09-30')).toEqual(d('2026-09-30'));
  });
});

describe('isPastCreditDeadline', () => {
  it('is past only once today (IST) is after the deadline day', () => {
    expect(isPastCreditDeadline('2025-26', '09-30', d('2026-09-30'))).toBe(false);
    expect(isPastCreditDeadline('2025-26', '09-30', d('2026-10-01'))).toBe(true);
    expect(isPastCreditDeadline('2025-26', '09-30', new Date('2026-09-30T18:30:00Z'))).toBe(true);
    expect(isPastCreditDeadline('2025-26', '09-30', new Date('2026-09-30T18:29:00Z'))).toBe(false);
    expect(isPastCreditDeadline('2025-26', undefined, d('2026-11-30'))).toBe(false);
    expect(isPastCreditDeadline('2025-26', undefined, d('2026-12-01'))).toBe(true);
  });
});
