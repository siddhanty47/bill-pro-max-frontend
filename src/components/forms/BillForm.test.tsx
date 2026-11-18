import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { BillForm } from './BillForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { Party } from '../../types';

const party = (over: Partial<Party> = {}) =>
  ({
    _id: 'p1',
    code: 'MEHT',
    name: 'Mehta Builders',
    roles: ['client'],
    contact: { person: 'Rakesh', phone: '98' },
    sites: [{ code: 'S1', address: 'Plot 12', stateCode: '27' }],
    agreements: [
      { agreementId: 'AG-1', status: 'active', siteCode: 'S1', terms: { billingCycle: 'monthly' } },
      { agreementId: 'AG-0', status: 'closed', siteCode: 'S1', terms: { billingCycle: 'weekly' } },
    ],
    ...over,
  }) as unknown as Party;

function setup(parties: Party[] = [party()], businessStateCode = '27') {
  server.use(
    http.get(apiUrl('/businesses'), () =>
      ok([
        {
          _id: 'biz-1',
          name: 'Patel Scaffold Co.',
          stateCode: businessStateCode,
          settings: { defaultTaxRate: 18 },
        },
      ])
    ),
    http.get(apiUrl('/businesses/biz-1/bills/next-number'), () => ok('B-2026-27-0005'))
  );
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <BillForm parties={parties} onSubmit={onSubmit} onCancel={onCancel} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

type User = ReturnType<typeof setup>['user'];

async function pickParty(user: User) {
  await user.type(screen.getByPlaceholderText(/party code/i), 'MEH');
  await user.click(await screen.findByRole('option', { name: /Mehta Builders/ }));
}

const submit = () => screen.getByRole('button', { name: /^generate bill$/i });

describe('BillForm', () => {
  it('submits the exact intra-state payload with the predicted bill number', async () => {
    const { user, onSubmit } = setup();
    await pickParty(user);
    await user.selectOptions(screen.getByLabelText(/^agreement/i), 'AG-1');
    expect(await screen.findByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByText('B-2026-27-')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^bill date/i), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(/period end/i), { target: { value: '2026-10-31' } });
    await waitFor(() => expect(screen.getByLabelText(/sgst/i)).toHaveValue(9));
    const discount = screen.getByLabelText(/discount rate/i);
    await user.clear(discount);
    await user.type(discount, '2.5');
    await user.type(screen.getByLabelText(/^notes/i), 'Thanks');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      billDate: '2026-11-01',
      partyId: 'p1',
      agreementId: 'AG-1',
      billingPeriod: { start: '2026-10-01', end: '2026-10-31' },
      billSequence: 5,
      taxMode: 'intra',
      taxRate: 18,
      sgstRate: 9,
      cgstRate: 9,
      igstRate: undefined,
      discountRate: 2.5,
      notes: 'Thanks',
    });
  });

  it('switches to inter-state when the site state differs and submits IGST only', async () => {
    const { user, onSubmit } = setup([party()], '24');
    await pickParty(user);
    await user.selectOptions(screen.getByLabelText(/^agreement/i), 'AG-1');
    await waitFor(() => expect(screen.getByLabelText(/tax mode/i)).toHaveValue('inter'));
    expect(screen.queryByLabelText(/sgst/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/igst/i)).toHaveValue(18);
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0];
    expect(body).toMatchObject({
      taxMode: 'inter',
      taxRate: 18,
      sgstRate: undefined,
      cgstRate: undefined,
      igstRate: 18,
      discountRate: 0,
      notes: undefined,
      billSequence: 5,
    });
  });

  it('lets the bill number be edited', async () => {
    const { user, onSubmit } = setup();
    await pickParty(user);
    await user.selectOptions(screen.getByLabelText(/^agreement/i), 'AG-1');
    const seq = await screen.findByDisplayValue('5');
    await user.clear(seq);
    await user.type(seq, '42');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].billSequence).toBe(42);
  });

  it('only lists active agreements and needs a party first', async () => {
    const { user } = setup();
    expect(screen.getByLabelText(/^agreement/i)).toBeDisabled();
    expect(screen.queryByText(/bill #/i)).not.toBeInTheDocument();
    await pickParty(user);
    expect(screen.getByRole('option', { name: /AG-1 \(monthly\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /AG-0/ })).not.toBeInTheDocument();
  });

  it('shows required messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(submit());
    expect(await screen.findByText('Select a party')).toBeInTheDocument();
    expect(screen.getByText('Select an agreement')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks the party label with exactly one star', () => {
    setup();
    expect(screen.getByText(/^Party/, { selector: 'label' }).textContent).toBe('Party *');
  });

  it('cancels', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
