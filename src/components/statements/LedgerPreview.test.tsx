import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { LedgerPreview } from './LedgerPreview';
import { tableRows } from './testUtils';
import type { LedgerStatementData } from '../../types';

const base: LedgerStatementData = {
  type: 'ledger',
  business: { name: 'Biz' },
  party: { name: 'Mehta Builders', code: 'MEHT' },
  period: { from: '2024-01-05', to: '2024-02-10' },
  openingBalance: 1500,
  entries: [
    {
      date: '2024-01-07',
      description: 'Bill',
      reference: 'B-001',
      debit: 12345.5,
      credit: 0,
      balance: 13845.5,
      billId: 'bill1',
    },
    {
      date: '2024-01-20',
      description: 'Payment',
      reference: 'PAY-9',
      debit: 0,
      credit: 5000,
      balance: 8845.5,
    },
  ],
  totalDebits: 12345.5,
  totalCredits: 5000,
  closingBalance: 8845.5,
  currency: 'INR',
};

describe('LedgerPreview', () => {
  it('renders the exact amounts, totals and links', () => {
    renderWithProviders(<LedgerPreview data={base} />);
    expect(screen.getByText(/ledger statement/i)).toHaveTextContent('Mehta Builders');
    expect(tableRows()).toEqual([
      ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
      ['Opening Balance', '1,500.00'],
      ['7/1/2024', 'Bill', 'B-001', '12,345.50', '-', '13,845.50'],
      ['20/1/2024', 'Payment', 'PAY-9', '-', '5,000.00', '8,845.50'],
      ['Totals', '12,345.50', '5,000.00', ''],
      ['Closing Balance', '8,845.50'],
    ]);
    expect(screen.getByRole('link', { name: 'B-001' })).toHaveAttribute('href', '/bills/bill1');
    expect(screen.queryByRole('link', { name: 'PAY-9' })).not.toBeInTheDocument();
  });

  it('shows a notice for an empty period', () => {
    renderWithProviders(<LedgerPreview data={{ ...base, entries: [] }} />);
    expect(screen.getByText('No transactions found for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
