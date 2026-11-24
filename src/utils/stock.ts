/**
 * Stock counts shown to people. Counts come from the backend's shared party-stock rules
 * (opening stock + challans), so every view shows the same number. A negative count is real
 * data (more came back than was sent) and is flagged, never hidden.
 */
import type { ValueTone } from '../components/ui/status';

/** Why a count is below zero and what to do about it. */
export const NEGATIVE_STOCK_NOTE =
  'Below zero means more came back than was sent. Check those items’ challans and opening stock.';

/** Colour for a stock count: negative counts stand out. */
export function stockTone(quantity: number): ValueTone | undefined {
  return quantity < 0 ? 'negative' : undefined;
}

/** True when any count is below zero. */
export function hasNegativeStock(quantities: number[]): boolean {
  return quantities.some(q => q < 0);
}
