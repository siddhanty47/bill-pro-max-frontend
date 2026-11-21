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
    await user.type(screen.getByPlaceholderText('Party code or name'), 'SUP');
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

  it('labels the party autocomplete with exactly one star', () => {
    setup();
    const input = screen.getByLabelText(/^party/i);
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText(/^Party/, { selector: 'label' }).textContent).toBe('Party *');
  });

  it('cancels', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('site', () => {
    const siteParty = (over: Partial<Party> = {}) =>
      party({
        _id: 'p3',
        code: 'KSD',
        name: 'KSD Construction',
        sites: [
          { code: 'KSDT', address: 'Tower road' },
          { code: 'KSDW', address: 'West road' },
        ],
        agreements: [{ agreementId: 'AG-T', siteCode: 'KSDT' }] as Party['agreements'],
        ...over,
      });

    function setupSites(p: Party) {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const utils = renderWithProviders(
        <PaymentForm
          parties={[p]}
          bills={[bill({ _id: 'b9', partyId: p._id, agreementId: 'AG-T', billNumber: 'B-009' })]}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      );
      return { ...utils, onSubmit };
    }

    async function pick(user: ReturnType<typeof setupSites>['user'], code: string) {
      await user.type(screen.getByPlaceholderText(/party code/i), code);
      await user.click(await screen.findByRole('option', { name: new RegExp(code) }));
    }

    it("takes the bill's site and locks the picker when a bill is linked", async () => {
      const { user } = setupSites(siteParty());
      await pick(user, 'KSD');
      await user.selectOptions(screen.getByLabelText(/link to bill/i), 'b9');
      const site = screen.getByLabelText(/^site/i);
      expect(site).toHaveValue('KSDT');
      expect(site).toBeDisabled();
    });

    it('preselects the only site of a one-site party', async () => {
      const { user, onSubmit } = setupSites(
        siteParty({ sites: [{ code: 'KSDT', address: 'Tower road' }] })
      );
      await pick(user, 'KSD');
      await user.type(screen.getByLabelText(/^amount/i), '700');
      await user.click(screen.getByRole('button', { name: /^record payment$/i }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ siteCode: 'KSDT' });
    });

    it('keeps a one-site party with a legacy opening total on the default site', async () => {
      const { user } = setupSites(
        siteParty({ sites: [{ code: 'KSDT', address: 'Tower road' }], openingBalance: 500 })
      );
      await pick(user, 'KSD');
      expect(screen.getByLabelText(/^site/i)).toHaveValue('');
    });

    it('sends the default site as null', async () => {
      const { user, onSubmit } = setupSites(siteParty());
      await pick(user, 'KSD');
      await user.selectOptions(screen.getByLabelText(/^site/i), 'KSDW');
      await user.selectOptions(screen.getByLabelText(/^site/i), '');
      await user.type(screen.getByLabelText(/^amount/i), '70');
      await user.click(screen.getByRole('button', { name: /^record payment$/i }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ siteCode: null });
    });
  });
});
