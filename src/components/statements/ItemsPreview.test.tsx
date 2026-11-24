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
  grandTotals: {
    totalOpening: 10,
    totalDelivered: 40,
    totalReturned: 15,
    netHeld: 25,
    totalDamaged: 2,
    totalShort: 3,
  },
};

describe('ItemsPreview', () => {
  it('renders each item ledger and the grand totals', () => {
    renderWithProviders(<ItemsPreview data={base} />);
    expect(screen.getByText(/item statement/i)).toHaveTextContent('Mehta Builders');
    expect(screen.getByText('Cuplock 2m')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(tableRows(0)).toEqual([
      ['Date', 'Challan #', 'Delivery qty', 'Return qty', 'Running qty'],
      ['Opening qty', '10'],
      ['7 Jan 2024', 'CH-1', '40', '-', '50'],
      ['20 Jan 2024', 'CH-2', '-', '15', '35'],
      ['Closing qty', '35'],
      ['Summary', '40', '15', 'Damaged 2 · Short 3'],
    ]);
    expect(tableRows(1)[3]).toEqual(['Summary', '0', '0', 'Damaged 0 · Short 0']);
    expect(screen.getByRole('link', { name: 'CH-2' })).toHaveAttribute('href', '/challans/c2');
    expect(screen.queryByText('Some counts are below zero')).not.toBeInTheDocument();
    for (const [label, value] of [
      ['Opening stock', '10'],
      ['Total delivered', '40'],
      ['Total returned', '15'],
      ['Held at end', '25'],
      ['Total damaged', '2'],
      ['Total short', '3'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
    }
  });

  it('shows opening stock as a row without a challan link, and flags a negative count', () => {
    renderWithProviders(
      <ItemsPreview
        data={{
          ...base,
          items: [
            {
              itemName: 'Inner 2 mtr',
              itemId: 'i3',
              openingQty: 0,
              events: [
                {
                  date: '2024-01-05',
                  challanNumber: 'Opening stock',
                  challanId: '',
                  type: 'opening',
                  quantity: 5,
                  runningQty: 5,
                },
                {
                  date: '2024-01-20',
                  challanNumber: 'CH-9',
                  challanId: 'c9',
                  type: 'return',
                  quantity: 23,
                  runningQty: -18,
                },
              ],
              totalDelivered: 0,
              totalReturned: 23,
              closingQty: -18,
              damages: { damaged: 0, short: 0, needRepair: 0 },
            },
          ],
          grandTotals: { ...base.grandTotals, netHeld: -18 },
        }}
      />
    );
    expect(tableRows(0).slice(2, 4)).toEqual([
      ['5 Jan 2024', 'Opening stock', '5', '-', '5'],
      ['20 Jan 2024', 'CH-9', '-', '23', '-18'],
    ]);
    expect(screen.queryByRole('link', { name: 'Opening stock' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Some counts are below zero');
  });

  it('shows a notice for an empty period', () => {
    renderWithProviders(<ItemsPreview data={{ ...base, items: [] }} />);
    expect(screen.getByText('No item activity found for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
