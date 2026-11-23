/** Small dashboard maths shared by the tiles and charts. */
import type { TrendDirection } from '../../components/ui';
import type { RangeKey, Trend } from '../../types';

/** A change shown with a ▲/▼ arrow (`direction`) before `text`; no direction = no arrow. */
export type Change = { direction?: TrendDirection; text: string };

/**
 * Month-on-month change: "▲ 12% vs last month" (positive) / "▼ 4% vs last month" (negative);
 * nothing when last month was 0.
 */
export function monthChange({ value, previous }: Trend): {
  change?: Change;
  tone?: 'positive' | 'negative';
} {
  if (!previous) return {};
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct > 0) {
    return { change: { direction: 'up', text: `${pct}% vs last month` }, tone: 'positive' };
  }
  if (pct < 0) {
    return {
      change: { direction: 'down', text: `${Math.abs(pct)}% vs last month` },
      tone: 'negative',
    };
  }
  return { change: { text: '0% vs last month' } };
}

/** The change as screen readers hear it: "up 12% vs last month". */
export const changeText = ({ direction, text }: Change): string =>
  direction ? `${direction} ${text}` : text;

/** A percentage held to 0–100 (legacy data can put more on rent than in stock). */
export const clampPct = (n: number): number => Math.min(100, Math.max(0, Number(n) || 0));

/** "over 1Y", or "over all time" for ALL. */
export const overRange = (range: RangeKey): string =>
  range === 'ALL' ? 'over all time' : `over ${range}`;

/** "▲ 6.0% over 1Y" / "▼ 2.1% over 3Y"; null change → no headline. */
export function steelChange(
  changePct: number | null | undefined,
  range: RangeKey
): Change | undefined {
  if (changePct == null) return undefined;
  return {
    direction: changePct < 0 ? 'down' : 'up',
    text: `${Math.abs(changePct).toFixed(1)}% ${overRange(range)}`,
  };
}

/** Accessible name of a chart: its title, then the headline when there is one. */
export const chartLabel = (title: string, headline?: string): string =>
  headline ? `${title}: ${headline}` : title;

export const fmtCount = (n: number): string => n.toLocaleString('en-IN');
