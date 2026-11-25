import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ChangeImpactDialog } from './ChangeImpactDialog';
import type { GateReport } from '../../types';

function renderDialog(report: GateReport) {
  return renderWithProviders(
    <ChangeImpactDialog report={report} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
  );
}

const issuedSection = () =>
  screen.getByRole('heading', { name: /Already sent/ }).closest('div') as HTMLElement;

describe('ChangeImpactDialog', () => {
  it('names the draft note each issued bill gets, by direction', () => {
    renderDialog({
      affected: [
        { billId: 'b1', billNumber: 'INV-1', status: 'sent', issued: true, noteAmount: 300 },
        { billId: 'b2', billNumber: 'INV-2', status: 'paid', issued: true, noteAmount: -125.5 },
      ],
      negative: [],
      requiresReason: true,
      blocked: null,
    });
    const section = issuedSection();
    expect(within(section).getByRole('link', { name: 'INV-1' })).toHaveAttribute(
      'href',
      '/bills/b1'
    );
    expect(within(section).getByText('Draft debit note')).toBeInTheDocument();
    expect(within(section).getByText('₹300')).toHaveClass('mono');
    expect(within(section).getByText('Draft credit note')).toBeInTheDocument();
    expect(within(section).getByText('₹125.50')).toHaveClass('mono');
  });

  it('lists an issued bill without an amount by its number only', () => {
    renderDialog({
      affected: [{ billId: 'b1', billNumber: 'INV-1', status: 'sent', issued: true }],
      negative: [],
      requiresReason: true,
      blocked: null,
    });
    const section = issuedSection();
    expect(within(section).getByRole('link', { name: 'INV-1' })).toBeInTheDocument();
    expect(within(section).queryByText(/Draft .* note/)).not.toBeInTheDocument();
  });
});
