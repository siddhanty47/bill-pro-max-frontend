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
      kind: 'bill',
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
      kind: 'bill',
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
    expect(screen.getByText(/As of/)).toHaveTextContent('1 Mar 2024');
    expect(tableRows()).toEqual([
      ['Bill #', 'Bill date', 'Due date', 'Days overdue', 'Total', 'Paid', 'Balance due', 'Bucket'],
      ['B-001', '7 Jan 2024', '6 Feb 2024', '24', '₹12,585.59', '₹5,000', '₹7,585.59', '0-30'],
      ['B-002', '2 Oct 2023', '1 Nov 2023', '121', '₹2,000', '₹0', '₹2,000', '90+'],
      ['Grand total', '₹9,585.59', ''],
    ]);
    expect(screen.getByRole('link', { name: 'B-001' })).toHaveAttribute('href', '/bills/b1');
    for (const [label, value] of [
      ['Current (0-30)', '₹7,585.59'],
      ['31-60 days', '₹0'],
      ['61-90 days', '₹0'],
      ['90+ days', '₹2,000'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
    }
  });

  it('shows opening balance and advance rows as plain text, not bill links', () => {
    renderWithProviders(
      <AgingPreview
        data={{
          ...base,
          bills: [
            { ...base.bills[1], kind: 'opening', billId: '', billNumber: 'Opening balance' },
            {
              ...base.bills[0],
              kind: 'advance',
              billId: '',
              billNumber: 'Advance / on-account credit',
              balanceDue: -150,
            },
          ],
        }}
      />
    );
    expect(screen.getByText('Opening balance')).toBeInTheDocument();
    expect(screen.getByText('Advance / on-account credit')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows a notice when nothing is outstanding', () => {
    renderWithProviders(<AgingPreview data={{ ...base, bills: [] }} />);
    expect(screen.getByText('No outstanding bills found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
