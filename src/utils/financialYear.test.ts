import { describe, expect, it } from 'vitest';
import {
  closedYearMessage,
  creditDeadlineMessage,
  creditNoteDeadline,
  creditNoteDeadlineSchema,
  deadlineLabel,
  effectiveEndDate,
  fyEnd,
  fyHasEnded,
  fyOf,
  isOnOrBeforeDay,
  isPastCreditDeadline,
  recentFys,
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
      "FY 2025-26 is closed for this site. Anything dated on or before 31 Mar 2026 can't be changed."
    );
    expect(closedYearMessage('2024-25', fyEnd('2024-25'))).toBe(
      "FY 2024-25 is closed for this site. Anything dated on or before 31 Mar 2025 can't be changed."
    );
  });
});

describe('fyHasEnded', () => {
  it('ends only once the IST day is after 31 March', () => {
    expect(fyHasEnded('2025-26', d('2026-03-31'))).toBe(false);
    expect(fyHasEnded('2025-26', new Date('2026-03-31T18:29:00Z'))).toBe(false);
    expect(fyHasEnded('2025-26', new Date('2026-03-31T18:30:00Z'))).toBe(true);
    expect(fyHasEnded('2024-25', d('2026-01-01'))).toBe(true);
  });
});

describe('recentFys', () => {
  it('lists the current FY, then the five before it', () => {
    expect(recentFys(d('2026-11-25'))).toEqual([
      '2026-27',
      '2025-26',
      '2024-25',
      '2023-24',
      '2022-23',
      '2021-22',
    ]);
    expect(recentFys(d('2026-03-31'))[0]).toBe('2025-26');
  });
});

describe('creditNoteDeadlineSchema', () => {
  const valid = (v: string) => creditNoteDeadlineSchema.safeParse(v).success;
  it('accepts real non-leap calendar days in MM-DD', () => {
    expect(valid('11-30')).toBe(true);
    expect(valid('02-28')).toBe(true);
    expect(valid('12-31')).toBe(true);
  });
  it('refuses other formats and impossible days', () => {
    expect(valid('02-29')).toBe(false);
    expect(valid('02-30')).toBe(false);
    expect(valid('13-01')).toBe(false);
    expect(valid('04-31')).toBe(false);
    expect(valid('1-30')).toBe(false);
    expect(valid('30 Nov')).toBe(false);
    expect(creditNoteDeadlineSchema.safeParse('02-30').error?.issues[0].message).toBe(
      'Not a calendar day'
    );
    expect(creditNoteDeadlineSchema.safeParse('x').error?.issues[0].message).toBe(
      'Use MM-DD, e.g. 11-30'
    );
  });
});

describe('deadlineLabel', () => {
  it('reads MM-DD as a day and month, defaulting to 30 Nov', () => {
    expect(deadlineLabel('09-30')).toBe('30 Sep');
    expect(deadlineLabel(undefined)).toBe('30 Nov');
    expect(deadlineLabel('02-30')).toBe('30 Nov');
  });
});

describe('creditDeadlineMessage', () => {
  it('names the FY and the deadline with its year', () => {
    expect(creditDeadlineMessage('2025-26', undefined)).toBe(
      'Credit notes for FY 2025-26 closed on 30 Nov 2026.'
    );
    expect(creditDeadlineMessage('2025-26', '09-30')).toBe(
      'Credit notes for FY 2025-26 closed on 30 Sep 2026.'
    );
  });
});

describe('effectiveEndDate', () => {
  const end = '2025-12-31T00:00:00.000Z';
  it('is the end date once the agreement is closed (not active, or rate-changed)', () => {
    expect(effectiveEndDate({ endDate: end, status: 'expired' })).toBe(end);
    expect(effectiveEndDate({ endDate: end, status: 'active', nextAgreementId: 'A2' })).toBe(end);
  });
  it('is open-ended for an active agreement or one without an end date', () => {
    expect(effectiveEndDate({ endDate: end, status: 'active' })).toBeUndefined();
    expect(effectiveEndDate({ endDate: null, status: 'terminated' })).toBeUndefined();
  });
});
