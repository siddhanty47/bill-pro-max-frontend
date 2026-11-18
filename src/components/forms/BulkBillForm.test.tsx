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
    await waitFor(() => expect(screen.getByLabelText(/sgst/i)).toHaveValue(9));
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
      taxMode: 'intra',
      sgstRate: 9,
      cgstRate: 9,
      igstRate: undefined,
      discountRate: 5,
      notes: undefined,
      agreements: [
        { partyId: 'p1', agreementId: 'AG-1' },
        { partyId: 'p2', agreementId: 'AG-2' },
      ],
    });
  });

  it('switches to inter-state when a selected site is in another state', async () => {
    const { user, onSubmit } = setup(
      [agr({}), agr({ agreementId: 'AG-2', partyId: 'p2', siteStateCode: '24' })],
      '27'
    );
    await user.click(screen.getByRole('checkbox', { name: /AG-2/ }));
    await waitFor(() => expect(screen.getByLabelText(/tax mode/i)).toHaveValue('inter'));
    expect(screen.queryByLabelText(/sgst/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/igst/i)).toHaveValue(18));
    await user.click(generate(1));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      taxMode: 'inter',
      sgstRate: undefined,
      cgstRate: undefined,
      igstRate: 18,
      agreements: [{ partyId: 'p2', agreementId: 'AG-2' }],
    });
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
