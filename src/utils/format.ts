/**
 * Display formatters shared by list, detail and dashboard pages.
 * Render the result in a `mono` cell/span (amounts right-aligned).
 */

/**
 * `₹1,84,200` (Indian grouping); non-integers get two decimals: `₹99.50`. Negative: `-₹2,500`.
 * Anything that rounds to zero (including `-0`) is `₹0`, never `-₹0` or `₹0.00`.
 */
export function formatMoney(n: number): string {
  if (Math.round(Math.abs(n) * 100) === 0) return '₹0';
  const decimals = Number.isInteger(n) ? 0 : 2;
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? '-' : ''}₹${abs}`;
}

const COMPACT_UNITS: Array<[number, string]> = [
  [1e7, 'Cr'],
  [1e5, 'L'],
  [1e3, 'k'],
];

/** One decimal, dropping a trailing `.0`. */
const oneDp = (n: number) => String(Math.round(n * 10) / 10);

/** Compact Indian number with an optional prefix (`₹`): see `formatMoneyCompact`. */
function compactIndian(n: number, prefix: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  for (let i = 0; i < COMPACT_UNITS.length; i++) {
    const [size, suffix] = COMPACT_UNITS[i];
    // a value that rounds to 1,000 of the unit below (e.g. 999.96 → 1000) reads as this unit
    const next = COMPACT_UNITS[i + 1];
    if (abs >= size || (next && Number(oneDp(abs / next[0])) >= size / next[0])) {
      return `${sign}${prefix}${oneDp(abs / size)}${suffix}`;
    }
  }
  if (Math.round(abs) >= 1000) return `${sign}${prefix}1k`;
  return Math.round(abs) === 0 ? `${prefix}0` : `${sign}${prefix}${Math.round(abs)}`;
}

/**
 * Short Indian amount for chart axes and headlines: `₹45k`, `₹4.5k`, `₹38.4L`, `₹1.2Cr`;
 * under ₹1,000 a whole rupee amount (`₹950`). A value that rounds up to the next unit uses it
 * (`₹99,960` → `₹1L`). Tooltips and tables use `formatMoney`.
 */
export function formatMoneyCompact(n: number): string {
  return compactIndian(n, '₹');
}

/** Short Indian count for chart axes: `950`, `4.5k`, `1.2L`, `3Cr`. */
export function formatCountCompact(n: number): string {
  return compactIndian(n, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a date; a date-only `YYYY-MM-DD` string is that calendar day locally, not UTC midnight. */
function toDate(d: string | Date): Date {
  if (typeof d !== 'string') return d;
  const m = DATE_ONLY.exec(d);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
}

export interface FormatDateOptions {
  /** `'always'` keeps the year even in the current year (financial documents). */
  year?: 'auto' | 'always';
}

/** Option for financial documents: always print the year. */
export const FULL_DATE: FormatDateOptions = { year: 'always' };

/**
 * `16 Nov` in the current year, `16 Nov 2025` otherwise (local time);
 * `{ year: 'always' }` always includes the year.
 * Missing or invalid input → `''` (so a DetailField shows "Not added").
 */
export function formatDate(
  d: string | Date | null | undefined,
  { year = 'auto' }: FormatDateOptions = {}
): string {
  if (d === null || d === undefined || d === '') return '';
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return '';
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return year === 'auto' && date.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
}

/** `16 Nov, 3:05 pm` (am/pm, local time); the year follows `formatDate`. */
export function formatDateTime(d: string | Date): string {
  const date = toDate(d);
  const h = date.getHours();
  const time = `${h % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return `${formatDate(date)}, ${time}`;
}

/** `November 2026` for a calendar month; `month` is 1–12. */
export function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
