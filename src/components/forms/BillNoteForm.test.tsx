import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillNoteForm, type BillNoteFormProps } from './BillNoteForm';

const intra = { taxMode: 'intra' as const, sgstRate: 9, cgstRate: 9, igstRate: 0 };

function setup(over: Partial<BillNoteFormProps> = {}) {
  const onSubmit = vi.fn<BillNoteFormProps['onSubmit']>().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <BillNoteForm
      mode="edit"
      source="manual"
      type="credit"
      bill={intra}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...over}
    />
  );
  return { user, onSubmit, onCancel };
}

const totalsRow = (label: string) =>
  within(screen.getByRole('table', { name: 'Note totals' }))
    .getByText(label)
    .closest('tr')!;

describe('BillNoteForm', () => {
  it('edits manual lines and submits reason and lines', async () => {
    const { user, onSubmit } = setup({
      initial: {
        reason: 'Rate agreed lower',
        lines: [
          { kind: 'hire', itemId: 'i1', itemName: 'Prop', description: 'Prop hire', amount: 100 },
        ],
      },
    });
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.selectOptions(screen.getByLabelText('Kind for line 2'), 'transport');
    await user.type(screen.getByLabelText('Description for line 2'), 'Extra trip');
    await user.type(screen.getByLabelText('Amount for line 2'), '50.5');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'Rate agreed lower',
      lines: [
        { kind: 'hire', itemId: 'i1', itemName: 'Prop', description: 'Prop hire', amount: 100 },
        { kind: 'transport', description: 'Extra trip', amount: 50.5 },
      ],
    });
  });

  it('previews tax from the bill rates, shown negative for a credit', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Amount for line 1'), '1000');
    expect(within(totalsRow('Subtotal')).getByText('-₹1,000')).toBeVisible();
    expect(within(totalsRow('SGST')).getByText('-₹90')).toBeVisible();
    expect(within(totalsRow('CGST')).getByText('-₹90')).toBeVisible();
    expect(within(totalsRow('Total')).getByText('-₹1,180')).toBeVisible();
  });

  it('shows IGST only for an inter-state bill, positive for a debit', async () => {
    const { user } = setup({
      type: 'debit',
      bill: { taxMode: 'inter', sgstRate: 0, cgstRate: 0, igstRate: 18 },
    });
    await user.type(screen.getByLabelText('Amount for line 1'), '100');
    expect(within(totalsRow('IGST')).getByText('₹18')).toBeVisible();
    expect(screen.queryByText('SGST')).not.toBeInTheDocument();
    expect(within(totalsRow('Total')).getByText('₹118')).toBeVisible();
  });

  it('requires a reason, a description and an amount above zero', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('Amount for line 1'), '0');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Add a reason')).toBeVisible();
    expect(screen.getByText('Line 1: Add a description')).toBeVisible();
    await user.type(screen.getByLabelText('Description for line 1'), 'Refund');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Line 1: Enter an amount above zero')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes a line, but never the last one', async () => {
    const { user } = setup();
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.queryByLabelText('Description for line 2')).not.toBeInTheDocument();
  });

  it('auto notes edit only the reason', async () => {
    const { user, onSubmit } = setup({
      source: 'auto',
      initial: { reason: '', lines: [{ kind: 'hire', description: 'Prop', amount: -20 }] },
    });
    expect(screen.queryByRole('table', { name: 'Note lines' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reason/), 'Challan date fixed');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'Challan date fixed' });
  });

  it('shows the server error and cancels', async () => {
    const { user, onCancel } = setup({ mode: 'create', error: 'Credit exceeds the bill' });
    expect(screen.getByRole('alert')).toHaveTextContent('Credit exceeds the bill');
    expect(screen.getByRole('button', { name: 'Create note' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
