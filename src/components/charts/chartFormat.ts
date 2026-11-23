import type { Bucket } from '../../types';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Split `YYYY-MM-DD` (calendar parts, no timezone shifting). */
function parts(t: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** X-axis label: month buckets "Nov 25", day/week buckets "23 Nov". */
export function formatTick(t: string, bucket: Bucket): string {
  const p = parts(t);
  if (!p) return t;
  if (bucket === 'month') return `${MONTHS_SHORT[p.m]} ${String(p.y).slice(-2)}`;
  return `${p.d} ${MONTHS_SHORT[p.m]}`;
}

/** Tooltip date: "November 2025" (month), "23 Nov 2025" (day), "Week of 23 Nov 2025" (week). */
export function formatTooltipDate(t: string, bucket: Bucket): string {
  const p = parts(t);
  if (!p) return t;
  if (bucket === 'month') return `${MONTHS_LONG[p.m]} ${p.y}`;
  const day = `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}`;
  return bucket === 'week' ? `Week of ${day}` : day;
}

const MAX_CODE = 8;

/** X label: the code (over 8 characters cut with "…"), else the name's initials. */
export function barLabel(code: unknown, name: unknown): string {
  const c = typeof code === 'string' ? code.trim() : '';
  if (c) return c.length > MAX_CODE ? `${c.slice(0, MAX_CODE - 1)}…` : c;
  const initials = String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(w => w[0].toUpperCase())
    .join('');
  return initials || '?';
}

/** 0 up to a round number at or above `max`, in about four 1/2/5×10ⁿ steps. */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, ([1, 2, 5, 10].find(m => m * pow >= raw) ?? 10) * pow);
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
