import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { PaymentForm } from './PaymentForm';
import { renderWithProviders } from '../../test/render';
import type { Bill, Party } from '../../types';

const party = (over: Partial<Party> = {}) =>
  ({
    _id: 'p1',
    code: 'MEHT',
    name: 'Mehta Builders',
    roles: ['client'],
    contact: { person: 'Rakesh', phone: '9820041275' },
    sites: [],
    ...over,
  }) as Party;

const bill = (over: Partial<Bill> = {}) =>
  ({
    _id: 'b1',
    partyId: 'p1',
    billNumber: 'B-001',
    status: 'sent',
    totalAmount: 5000,
    amountPaid: 1000,
    ...over,
  }) as Bill;

const PARTIES = [
  party(),
  party({ _id: 'p2', code: 'SUPP', name: 'Supply Co', roles: ['supplier'] }),
];

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <PaymentForm
      parties={PARTIES}
      bills={[bill(), bill({ _id: 'b2', billNumber: 'B-002', status: 'paid' })]}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
  return { ...utils, onSubmit, onCancel };
}

const today = new Date().toISOString().split('T')[0];

describe('PaymentForm', () => {
  it('submits the exact payload for a receivable linked to a bill', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByPlaceholderText(/party code/i), 'MEH');
    await user.click(await screen.findByRole('option', { name: /Mehta Builders/ }));
    await user.selectOptions(screen.getByLabelText(/link to bill/i), 'b1');
    await user.type(screen.getByLabelText(/^amount/i), '1500.5');
    await user.selectOptions(screen.getByLabelText(/payment method/i), 'upi');
    await user.type(screen.getByLabelText(/reference/i), 'UTR123');
    await user.type(screen.getByLabelText(/^notes/i), 'Part payment');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'receivable',
      partyId: 'p1',
      billId: 'b1',
      amount: 1500.5,
      method: 'upi',
      reference: 'UTR123',
      date: today,
      notes: 'Part payment',
    });
  });

  it('only offers unpaid bills of the chosen party', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/party code/i), 'MEH');
    await user.click(await screen.findByRole('option', { name: /Mehta Builders/ }));
    const select = screen.getByLabelText(/link to bill/i);
    expect(select).toHaveTextContent('B-001');
    expect(select).not.toHaveTextContent('B-002');
  });

  it('submits a payable to a supplier with omitted optionals', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/payment type/i), 'payable');
    await user.type(screen.getByPlaceholderText(/party code/i), 'SUP');
    await user.click(await screen.findByRole('option', { name: /Supply Co/ }));
    expect(screen.queryByLabelText(/link to bill/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^amount/i), '200');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'payable',
      partyId: 'p2',
      billId: undefined,
      amount: 200,
      method: 'bank_transfer',
      reference: undefined,
      date: today,
      notes: undefined,
    });
  });

  it('shows validation messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));
    expect(await screen.findByText('Select a party')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a zero amount with the positive-amount message', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^amount/i), '0');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));
    expect(await screen.findByText('Amount must be positive')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
