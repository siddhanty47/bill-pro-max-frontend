/** Small dashboard maths shared by the tiles and charts. */
import type { RangeKey, Trend } from '../../types';

export type TrendNote = { note?: string; noteTone?: 'positive' | 'negative' };

/** "▲ 12% vs last month" (positive) / "▼ 4% vs last month" (negative); nothing when last month was 0. */
export function trendNote({ value, previous }: Trend): TrendNote {
  if (!previous) return {};
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct > 0) return { note: `▲ ${pct}% vs last month`, noteTone: 'positive' };
  if (pct < 0) return { note: `▼ ${Math.abs(pct)}% vs last month`, noteTone: 'negative' };
  return { note: '0% vs last month' };
}

/** A percentage held to 0–100 (legacy data can put more on rent than in stock). */
export const clampPct = (n: number): number => Math.min(100, Math.max(0, Number(n) || 0));

/** "over 1Y", or "over all time" for ALL. */
export const overRange = (range: RangeKey): string =>
  range === 'ALL' ? 'over all time' : `over ${range}`;

/** "▲ 6.0% over 1Y" / "▼ 2.1% over 3Y"; null change → no headline. */
export function steelHeadline(changePct: number | null | undefined, range: RangeKey) {
  if (changePct == null) return undefined;
  const arrow = changePct < 0 ? '▼' : '▲';
  return `${arrow} ${Math.abs(changePct).toFixed(1)}% ${overRange(range)}`;
}

export const fmtCount = (n: number): string => n.toLocaleString('en-IN');
