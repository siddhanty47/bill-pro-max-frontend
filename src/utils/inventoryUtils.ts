/**
 * @file Inventory utilities
 * @description Compute rented and available from quantity history (client-side)
 */

import type { QuantityTransaction } from '../types';

function getRentedDelta(tx: QuantityTransaction): number {
  if (tx.rentedDelta != null) return tx.rentedDelta;
  switch (tx.type) {
    case 'challan_delivery':
      return tx.quantity;
    case 'challan_return':
      return -tx.quantity;
    case 'challan_delivery_reversed':
      return -tx.quantity;
    case 'challan_return_reversed':
      return tx.quantity;
    case 'challan_item_edit':
      return 0;
    default:
      return 0;
  }
}

export function computeRentedFromHistory(quantityHistory?: QuantityTransaction[]): number {
  return (quantityHistory || []).reduce((sum, tx) => sum + getRentedDelta(tx), 0);
}

export function computeAvailable(totalQuantity: number, rentedQuantity: number): number {
  return Math.max(0, totalQuantity - rentedQuantity);
}
