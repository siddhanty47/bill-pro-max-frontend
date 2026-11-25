import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ChangeImpactDialog } from './ChangeImpactDialog';
import type { GateReport } from '../../types';

const NOTE_LINE = 'A draft credit or debit note will be updated after you save.';

function renderDialog(report: GateReport) {
  return renderWithProviders(
    <ChangeImpactDialog report={report} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
  );
}

describe('ChangeImpactDialog', () => {
  it('lists issued bills by number with one line about their draft note', () => {
    // The backend dry run's real payload: no amounts
    renderDialog({
      affected: [
        { billId: 'b1', billNumber: 'INV-1', status: 'sent', issued: true },
        { billId: 'b2', billNumber: 'INV-2', status: 'paid', issued: true },
      ],
      negative: [],
      requiresReason: true,
      blocked: null,
    });
    const section = screen.getByRole('heading', { name: /Already sent/ }).closest('div')!;
    expect(within(section).getByRole('link', { name: 'INV-1' })).toHaveAttribute(
      'href',
      '/bills/b1'
    );
    expect(within(section).getByRole('link', { name: 'INV-2' })).toHaveAttribute(
      'href',
      '/bills/b2'
    );
    expect(within(section).getAllByText(NOTE_LINE)).toHaveLength(1);
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it('says nothing about notes when only drafts are affected', () => {
    renderDialog({
      affected: [{ billId: 'b1', billNumber: 'INV-1', status: 'draft', issued: false }],
      negative: [],
      requiresReason: false,
      blocked: null,
    });
    expect(screen.getByRole('link', { name: 'INV-1' })).toBeInTheDocument();
    expect(screen.queryByText(NOTE_LINE)).not.toBeInTheDocument();
  });
});
