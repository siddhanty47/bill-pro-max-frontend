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

  it('shows only the closed-year message and a Close button in closed-year mode', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { user } = renderWithProviders(
      <ChangeImpactDialog
        report={{
          affected: [{ billId: 'b1', billNumber: 'INV-1', status: 'sent', issued: true }],
          negative: [],
          requiresReason: true,
          blocked: 'closedYear',
          closedYear: '2025-26',
        }}
        busy={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'FY 2025-26 is closed for this site. Nothing dated on or before 31 Mar 2026 can change.'
    );
    expect(within(dialog).queryByRole('link', { name: 'INV-1' })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Reason/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save anyway' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByText('Close'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
