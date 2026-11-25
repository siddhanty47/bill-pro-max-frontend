import { describe, expect, it } from 'vitest';
import {
  closedYearMessage,
  creditNoteDeadline,
  fyEnd,
  fyOf,
  isOnOrBeforeDay,
  isPastCreditDeadline,
} from './financialYear';

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

describe('isOnOrBeforeDay', () => {
  it('compares IST calendar days', () => {
    const locked = '2026-03-31T00:00:00.000Z';
    expect(isOnOrBeforeDay('2026-03-31', locked)).toBe(true);
    expect(isOnOrBeforeDay('2026-03-30T00:00:00.000Z', locked)).toBe(true);
    expect(isOnOrBeforeDay('2026-04-01', locked)).toBe(false);
    // 31 Mar 23:00 IST is still 31 Mar; 1 Apr 00:30 IST is not
    expect(isOnOrBeforeDay(new Date('2026-03-31T17:30:00Z'), locked)).toBe(true);
    expect(isOnOrBeforeDay(new Date('2026-03-31T19:00:00Z'), locked)).toBe(false);
  });
});

describe('closedYearMessage', () => {
  it('names the FY and the lock day with its year', () => {
    expect(closedYearMessage('2025-26', '2026-03-31T00:00:00.000Z')).toBe(
      'FY 2025-26 is closed for this site. Nothing dated on or before 31 Mar 2026 can change.'
    );
    expect(closedYearMessage('2024-25', fyEnd('2024-25'))).toBe(
      'FY 2024-25 is closed for this site. Nothing dated on or before 31 Mar 2025 can change.'
    );
  });
});
