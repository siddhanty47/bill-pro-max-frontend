/**
 * Display formatters shared by list, detail and dashboard pages.
 * Render the result in a `mono` cell/span (amounts right-aligned).
 */

/** `₹1,84,200` (Indian grouping); non-integers get two decimals: `₹99.50`. Negative: `-₹2,500`. */
export function formatMoney(n: number): string {
  const decimals = Number.isInteger(n) ? 0 : 2;
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? '-' : ''}₹${abs}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `16 Nov` in the current year, `16 Nov 2025` otherwise (local time). Invalid input → `''`. */
export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${date.getFullYear()}`;
}
