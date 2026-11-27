import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { BulkBillForm } from './BulkBillForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { AgreementWithParty } from '../../types';

const agr = (over: Partial<AgreementWithParty>) =>
  ({
    agreementId: 'AG-1',
    partyId: 'p1',
    partyName: 'Mehta Builders',
    siteCode: 'S1',
    siteAddress: 'Plot 12',
    siteStateCode: '27',
    status: 'active',
    ...over,
  }) as unknown as AgreementWithParty;

const agreements = [
  agr({}),
  agr({ agreementId: 'AG-2', partyId: 'p2', partyName: 'Om Constructions', siteCode: 'S9' }),
  agr({ agreementId: 'AG-3', partyId: 'p3', partyName: 'Closed Co', status: 'terminated' }),
];

function setup(list = agreements, stateCode = '27') {
  server.use(
    http.get(apiUrl('/businesses'), () =>
      ok([{ _id: 'biz-1', name: 'Patel', stateCode, settings: { defaultTaxRate: 18 } }])
    )
  );
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <BulkBillForm agreements={list} onSubmit={onSubmit} onCancel={onCancel} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

const generate = (n: number) =>
  screen.getByRole('button', { name: new RegExp(`^generate ${n} bills?$`, 'i') });

describe('BulkBillForm', () => {
  it('submits the exact payload for the selected agreements', async () => {
    const { user, onSubmit } = setup();
    await waitFor(() => expect(screen.getByLabelText(/^sgst/i)).toHaveValue(9));
    fireEvent.change(screen.getByLabelText(/^bill date/i), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(/period end/i), { target: { value: '2026-10-31' } });
    const discount = screen.getByLabelText(/discount/i);
    await user.clear(discount);
    await user.type(discount, '5');
    expect(screen.queryByText('AG-3')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /AG-1/ }));
    await user.click(screen.getByRole('checkbox', { name: /AG-2/ }));
    await user.click(generate(2));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      billDate: '2026-11-01',
      billingPeriod: { start: '2026-10-01', end: '2026-10-31' },
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 18,
      discountRate: 5,
      notes: undefined,
      agreements: [
        { partyId: 'p1', agreementId: 'AG-1' },
        { partyId: 'p2', agreementId: 'AG-2' },
      ],
    });
  });

  it('fills the period end with the last day of the start month', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: '2026-06-01' } });
    expect(screen.getByLabelText(/period end/i)).toHaveValue('2026-06-30');
  });

  it('warns when the period runs over more than one month', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/period end/i), { target: { value: '2026-11-30' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      'This period covers 6 months (Jun to Nov)'
    );
  });

  it('refuses an end date before the start', async () => {
    const { user, onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/period start/i), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByLabelText(/period end/i), { target: { value: '2026-06-01' } });
    await user.click(screen.getByRole('checkbox', { name: /AG-1/ }));
    await user.click(generate(1));
    expect(await screen.findByText('End date must be on or after the start')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lists an agreement closed by a rate change, with its end date', () => {
    setup([
      ...agreements,
      agr({
        agreementId: 'AG-OLD',
        status: 'expired',
        endDate: '2026-08-31T00:00:00.000Z',
        nextAgreementId: 'AG-1',
      } as Partial<AgreementWithParty>),
      agr({ agreementId: 'AG-GONE', status: 'expired' }),
    ]);
    expect(screen.getByRole('checkbox', { name: /AG-OLD.*until 31 Aug 2026/ })).toBeInTheDocument();
    expect(screen.queryByText('AG-GONE')).not.toBeInTheDocument();
  });

  it('shows each agreement its own GST and lets the server pick the mode', async () => {
    const { user, onSubmit } = setup(
      [
        agr({}),
        agr({ agreementId: 'AG-2', partyId: 'p2', siteStateCode: '24' }),
        agr({ agreementId: 'AG-3', partyId: 'p3', siteStateCode: undefined }),
      ],
      '27'
    );
    expect(
      await screen.findByRole('checkbox', { name: /AG-1.*CGST \+ SGST$/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /AG-2.*IGST$/ })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /AG-3.*CGST \+ SGST \(state not set\)/ })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/tax mode/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^igst/i)).toHaveValue(18));
    await user.click(screen.getByRole('checkbox', { name: /AG-1/ }));
    await user.click(screen.getByRole('checkbox', { name: /AG-2/ }));
    await user.click(generate(2));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty('taxMode');
    expect(payload).toMatchObject({ sgstRate: 9, cgstRate: 9, igstRate: 18 });
  });

  it('filters by search, selects all filtered and clears them again', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/search by party/i), 'om cons');
    expect(screen.queryByText('Mehta Builders')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText(/search by party/i));
    await user.type(screen.getByPlaceholderText(/search by party/i), 'zzz');
    expect(screen.getByText('No agreements match your search.')).toBeInTheDocument();
  });

  it('disables generate until an agreement is chosen and handles empty and cancel', async () => {
    const { user, onCancel } = setup([]);
    expect(screen.getByText('No active agreements found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^generate 0 bills$/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
