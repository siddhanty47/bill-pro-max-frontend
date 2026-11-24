import { Notice } from '../ui';
import { NEGATIVE_STOCK_NOTE, hasNegativeStock } from '../../utils/stock';

/** Warning shown above a stock list when any count is below zero; nothing otherwise. */
export function NegativeStockNotice({
  quantities,
  className,
}: {
  quantities: number[];
  className?: string;
}) {
  if (!hasNegativeStock(quantities)) return null;
  return (
    <Notice tone="warning" title="Some counts are below zero" className={className}>
      {NEGATIVE_STOCK_NOTE}
    </Notice>
  );
}
