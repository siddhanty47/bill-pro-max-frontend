import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { AgingPreview } from './AgingPreview';
import { tableRows } from './testUtils';
import type { AgingStatementData } from '../../types';

const base: AgingStatementData = {
  type: 'aging',
  business: { name: 'Biz' },
  party: { name: 'Mehta Builders', code: 'MEHT' },
  asOfDate: '2024-03-01',
  bills: [
    {
      billId: 'b1',
      billNumber: 'B-001',
      billDate: '2024-01-07',
      dueDate: '2024-02-06',
      daysOverdue: 24,
      totalAmount: 12585.59,
      amountPaid: 5000,
      balanceDue: 7585.59,
      bucket: '0-30',
    },
    {
      billId: 'b2',
      billNumber: 'B-002',
      billDate: '2023-10-02',
      dueDate: '2023-11-01',
      daysOverdue: 121,
      totalAmount: 2000,
      amountPaid: 0,
      balanceDue: 2000,
      bucket: '90+',
    },
  ],
  buckets: { current: 7585.59, days31_60: 0, days61_90: 0, days90Plus: 2000 },
  grandTotal: 9585.59,
  currency: 'INR',
};

describe('AgingPreview', () => {
  it('renders the exact amounts, grand total and buckets', () => {
    renderWithProviders(<AgingPreview data={base} />);
    expect(screen.getByText(/aging statement/i)).toHaveTextContent('Mehta Builders');
    expect(screen.getByText(/As of/)).toHaveTextContent('1/3/2024');
    expect(tableRows()).toEqual([
      ['Bill #', 'Bill Date', 'Due Date', 'Days Overdue', 'Total', 'Paid', 'Balance Due', 'Bucket'],
      ['B-001', '7/1/2024', '6/2/2024', '24', '12,585.59', '5,000.00', '7,585.59', '0-30'],
      ['B-002', '2/10/2023', '1/11/2023', '121', '2,000.00', '0.00', '2,000.00', '90+'],
      ['Grand Total', '9,585.59', ''],
    ]);
    expect(screen.getByRole('link', { name: 'B-001' })).toHaveAttribute('href', '/bills/b1');
    for (const [label, value] of [
      ['Current (0-30)', '7,585.59'],
      ['31-60 Days', '0.00'],
      ['61-90 Days', '0.00'],
      ['90+ Days', '2,000.00'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
    }
  });

  it('shows a notice when nothing is outstanding', () => {
    renderWithProviders(<AgingPreview data={{ ...base, bills: [] }} />);
    expect(screen.getByText('No outstanding bills found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
