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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a date; a date-only `YYYY-MM-DD` string is that calendar day locally, not UTC midnight. */
function toDate(d: string | Date): Date {
  if (typeof d !== 'string') return d;
  const m = DATE_ONLY.exec(d);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
}

/**
 * `16 Nov` in the current year, `16 Nov 2025` otherwise (local time).
 * Missing or invalid input → `''` (so a DetailField shows "Not added").
 */
export function formatDate(d: string | Date | null | undefined): string {
  if (d === null || d === undefined || d === '') return '';
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return '';
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`;
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
