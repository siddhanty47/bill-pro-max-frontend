import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime, formatDate, formatMoney } from './format';

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

  it('adds the year for other years', () => {
    expect(formatDate(new Date(2025, 10, 16))).toBe('16 Nov 2025');
  });

  it('accepts ISO strings', () => {
    expect(formatDate('2026-01-05T10:00:00')).toBe('5 Jan');
    expect(formatDate('2024-12-31T10:00:00')).toBe('31 Dec 2024');
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('appends a 12-hour time to the date', () => {
    expect(formatDateTime(new Date('2020-03-05T15:05:00'))).toBe('5 Mar 2020, 3:05 pm');
    expect(formatDateTime(new Date('2020-03-05T00:07:00'))).toBe('5 Mar 2020, 12:07 am');
  });
});
