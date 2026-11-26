/** @fileoverview The inventory table's CSV export. */
import { toCsv } from '../../utils/csv';
import type { Inventory } from '../../types';

type Counts = { available: (item: Inventory) => number; rented: (item: Inventory) => number };

/** The CSV of `items`: the columns the table shows, quantities and rate as plain numbers. */
export function inventoryCsv(items: Inventory[], { available, rented }: Counts): string {
  return toCsv(
    ['Code', 'Name', 'Category', 'Unit', 'Total', 'Available', 'Rented', 'Daily rate'],
    items.map(item => [
      item.code,
      item.name,
      item.category,
      item.unit,
      item.totalQuantity,
      available(item),
      rented(item),
      item.defaultRatePerDay || null,
    ])
  );
}
