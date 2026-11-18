import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FULL_DATE, formatDateTime, formatDate, formatMoney, formatMonth } from './format';

describe('formatMoney', () => {
  it('uses Indian grouping with a rupee sign and no decimals for integers', () => {
    expect(formatMoney(184200)).toBe('₹1,84,200');
    expect(formatMoney(0)).toBe('₹0');
    expect(formatMoney(12345678)).toBe('₹1,23,45,678');
  });

  it('shows two decimals for non-integers', () => {
    expect(formatMoney(99.5)).toBe('₹99.50');
    expect(formatMoney(1000.256)).toBe('₹1,000.26');
  });

  it('puts the minus sign before the rupee sign', () => {
    expect(formatMoney(-2500)).toBe('-₹2,500');
    expect(formatMoney(-0.5)).toBe('-₹0.50');
  });

  it('shows ₹0 for negative zero and anything that rounds to zero', () => {
    expect(formatMoney(-0)).toBe('₹0');
    expect(formatMoney(-0.004)).toBe('₹0');
    expect(formatMoney(0.001)).toBe('₹0');
  });
});

describe('formatMonth', () => {
  it('names the month and year (month is 1–12)', () => {
    expect(formatMonth(2026, 11)).toBe('November 2026');
    expect(formatMonth(2025, 1)).toBe('January 2025');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 16, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('omits the year for dates in the current year', () => {
    expect(formatDate(new Date(2026, 10, 16))).toBe('16 Nov');
    expect(formatDate(new Date(2026, 8, 3))).toBe('3 Sep');
  });

  it("keeps the year in the current year with { year: 'always' }", () => {
    expect(formatDate(new Date(2026, 10, 16), { year: 'always' })).toBe('16 Nov 2026');
    expect(formatDate('2026-04-01', FULL_DATE)).toBe('1 Apr 2026');
    expect(formatDate('2025-04-01', FULL_DATE)).toBe('1 Apr 2025');
    expect(formatDate(null, FULL_DATE)).toBe('');
  });

  it('adds the year for other years', () => {
    expect(formatDate(new Date(2025, 10, 16))).toBe('16 Nov 2025');
  });

  it('accepts ISO strings', () => {
    expect(formatDate('2026-01-05T10:00:00')).toBe('5 Jan');
    expect(formatDate('2024-12-31T10:00:00')).toBe('31 Dec 2024');
  });

  it('returns an empty string for invalid or missing dates', () => {
    expect(formatDate('not a date')).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
  });

  it('reads a date-only string as that local calendar day, not UTC midnight', () => {
    // vitest runs in UTC, where both readings agree; a zone west of UTC tells them apart
    // (UTC midnight there is the previous evening).
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
      .process.env;
    const tz = env.TZ;
    env.TZ = 'America/New_York';
    try {
      expect(new Date('2026-01-05').getDate()).toBe(4);
      expect(formatDate('2026-01-05')).toBe('5 Jan');
      expect(formatDate('2024-12-31')).toBe('31 Dec 2024');
      expect(formatDate('2024-03-01')).toBe('1 Mar 2024');
    } finally {
      env.TZ = tz;
    }
  });
});

describe('formatDateTime', () => {
  it('appends a 12-hour time to the date', () => {
    expect(formatDateTime(new Date('2020-03-05T15:05:00'))).toBe('5 Mar 2020, 3:05 pm');
    expect(formatDateTime(new Date('2020-03-05T00:07:00'))).toBe('5 Mar 2020, 12:07 am');
  });
});
