import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { BillsPreview } from './BillsPreview';
import { tableRows } from './testUtils';
import type { BillStatementData } from '../../types';

const base: BillStatementData = {
  type: 'bills',
  business: { name: 'Biz' },
  party: { name: 'Mehta Builders', code: 'MEHT' },
  period: { from: '2024-01-05', to: '2024-02-10' },
  siteCode: 'S1',
  bills: [
    {
      billId: 'b1',
      billNumber: 'B-001',
      billDate: '2024-01-07',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      siteCode: 'S1',
      rentCharges: 10000,
      transportationCharges: 500.5,
      damageCharges: 250,
      subtotal: 10750.5,
      taxAmount: 1935.09,
      discountAmount: 100,
      totalAmount: 12585.59,
      notesTotal: 0,
    },
    {
      billId: 'b2',
      billNumber: 'B-002',
      billDate: '2024-02-02',
      siteCode: '',
      rentCharges: 2000,
      transportationCharges: 0,
      damageCharges: 0,
      subtotal: 2000,
      taxAmount: 360,
      discountAmount: 0,
      totalAmount: 2360,
      notesTotal: 0,
    },
  ],
  totals: {
    rentCharges: 12000,
    transportationCharges: 500.5,
    damageCharges: 250,
    subtotal: 12750.5,
    taxAmount: 2295.09,
    discountAmount: 100,
    totalAmount: 14945.59,
    notesTotal: 0,
    billCount: 2,
  },
  currency: 'INR',
};

describe('BillsPreview', () => {
  it('renders the exact amounts, totals and links', () => {
    renderWithProviders(<BillsPreview data={base} />);
    expect(screen.getByText(/bill statement/i)).toHaveTextContent('Mehta Builders');
    expect(screen.getByText(/Site: S1/)).toBeInTheDocument();
    expect(tableRows()).toEqual([
      [
        'Bill #',
        'Date',
        'Site',
        'Period',
        'Rent',
        'Transport',
        'Damage',
        'Subtotal',
        'Tax',
        'Discount',
        'Total',
      ],
      [
        'B-001',
        '7 Jan 2024',
        'S1',
        '1 Jan 2024 - 31 Jan 2024',
        '₹10,000',
        '₹500.50',
        '₹250',
        '₹10,750.50',
        '₹1,935.09',
        '₹100',
        '₹12,585.59',
      ],
      ['B-002', '2 Feb 2024', '-', '-', '₹2,000', '₹0', '₹0', '₹2,000', '₹360', '₹0', '₹2,360'],
      [
        'Totals (2 bills)',
        '₹12,000',
        '₹500.50',
        '₹250',
        '₹12,750.50',
        '₹2,295.09',
        '₹100',
        '₹14,945.59',
      ],
    ]);
    expect(screen.getByRole('link', { name: 'B-002' })).toHaveAttribute('href', '/bills/b2');
  });

  it('says "1 bill" in the totals row for a single bill', () => {
    renderWithProviders(
      <BillsPreview
        data={{ ...base, bills: [base.bills[0]], totals: { ...base.totals, billCount: 1 } }}
      />
    );
    expect(screen.getByText('Totals (1 bill)')).toBeInTheDocument();
  });

  it('shows a notice for an empty period', () => {
    renderWithProviders(<BillsPreview data={{ ...base, bills: [], siteCode: undefined }} />);
    expect(screen.getByText('No bills found for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Site:/)).not.toBeInTheDocument();
  });
});
