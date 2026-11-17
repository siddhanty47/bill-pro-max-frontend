import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ItemsPreview } from './ItemsPreview';
import { tableRows } from './testUtils';
import type { ItemStatementData } from '../../types';

const base: ItemStatementData = {
  type: 'items',
  business: { name: 'Biz' },
  party: { name: 'Mehta Builders', code: 'MEHT' },
  period: { from: '2024-01-05', to: '2024-02-10' },
  items: [
    {
      itemName: 'Cuplock 2m',
      itemId: 'i1',
      openingQty: 10,
      events: [
        {
          date: '2024-01-07',
          challanNumber: 'CH-1',
          challanId: 'c1',
          type: 'delivery',
          quantity: 40,
          runningQty: 50,
        },
        {
          date: '2024-01-20',
          challanNumber: 'CH-2',
          challanId: 'c2',
          type: 'return',
          quantity: 15,
          runningQty: 35,
        },
      ],
      totalDelivered: 40,
      totalReturned: 15,
      closingQty: 35,
      damages: { damaged: 2, short: 3, needRepair: 1 },
    },
    {
      itemName: 'Plank',
      itemId: 'i2',
      openingQty: 0,
      events: [],
      totalDelivered: 0,
      totalReturned: 0,
      closingQty: 0,
      damages: { damaged: 0, short: 0, needRepair: 0 },
    },
  ],
  grandTotals: { totalDelivered: 40, totalReturned: 15, netHeld: 25, totalDamaged: 2, totalShort: 3 },
};

describe('ItemsPreview', () => {
  it('renders each item ledger and the grand totals', () => {
    renderWithProviders(<ItemsPreview data={base} />);
    expect(screen.getByText(/item statement/i)).toHaveTextContent('Mehta Builders');
    expect(screen.getByText('Cuplock 2m')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(tableRows(0)).toEqual([
      ['Date', 'Challan #', 'Delivery Qty', 'Return Qty', 'Running Qty'],
      ['Opening Qty', '10'],
      ['7/1/2024', 'CH-1', '40', '-', '50'],
      ['20/1/2024', 'CH-2', '-', '15', '35'],
      ['Closing Qty', '35'],
      ['Summary', '40', '15', 'Dmg: 2 | Short: 3'],
    ]);
    expect(tableRows(1)[3]).toEqual(['Summary', '0', '0', 'Dmg: 0 | Short: 0']);
    expect(screen.getByRole('link', { name: 'CH-2' })).toHaveAttribute('href', '/challans/c2');
    for (const [label, value] of [
      ['Total Delivered', '40'],
      ['Total Returned', '15'],
      ['Net Held', '25'],
      ['Total Damaged', '2'],
      ['Total Short', '3'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
    }
  });

  it('shows a notice for an empty period', () => {
    renderWithProviders(<ItemsPreview data={{ ...base, items: [] }} />);
    expect(screen.getByText('No item activity found for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
