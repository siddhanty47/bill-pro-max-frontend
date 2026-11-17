import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { BusinessForm } from './BusinessForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';

const GSTIN = '27AABCM1234F1Z5';

function setup() {
  server.use(http.get(apiUrl('/businesses'), () => ok([])));
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(<BusinessForm onSubmit={onSubmit} onCancel={onCancel} />, {
    preloadedState: signedIn(),
  });
  return { ...utils, onSubmit, onCancel };
}

const details = (over = {}) => ({
  gstin: GSTIN,
  legalName: 'Mehta Legal Pvt Ltd',
  tradeName: 'Mehta Builders',
  address: '12 Link Road, Andheri',
  status: 'Active',
  isActive: true,
  ...over,
});

describe('BusinessForm', () => {
  it('submits the exact payload for a full fill', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/business name/i), 'Acme Rentals');
    await user.type(screen.getByLabelText(/address/i), '1 Main St');
    await user.type(screen.getByLabelText(/phone/i), '9820041275');
    await user.type(screen.getByLabelText(/email/i), 'a@acme.in');
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.selectOptions(screen.getByLabelText(/billing cycle/i), 'weekly');
    await user.click(screen.getByRole('button', { name: /^create business$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Acme Rentals',
      address: '1 Main St',
      phone: '9820041275',
      email: 'a@acme.in',
      gst: GSTIN,
      stateCode: '27',
      settings: {
        billingCycle: 'weekly',
        currency: 'INR',
        defaultTaxRate: 18,
        defaultSgstRate: 9,
        defaultCgstRate: 9,
        defaultIgstRate: 18,
        defaultPaymentDueDays: 15,
      },
    });
  });

  it('submits only the name with defaults and omits empty optionals', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/business name/i), 'Acme');
    await user.click(screen.getByRole('button', { name: /^create business$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Acme',
      address: undefined,
      phone: undefined,
      email: undefined,
      gst: undefined,
      stateCode: undefined,
      settings: {
        billingCycle: 'monthly',
        currency: 'INR',
        defaultTaxRate: 18,
        defaultSgstRate: 9,
        defaultCgstRate: 9,
        defaultIgstRate: 18,
        defaultPaymentDueDays: 15,
      },
    });
  });

  it('shows validation messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /^create business$/i }));
    expect(await screen.findByText('Business name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('fetches GST details and fills name, address and state code', async () => {
    server.use(http.get(apiUrl(`/gstin/${GSTIN}`), () => ok(details())));
    const { user } = setup();
    const fetchBtn = screen.getByRole('button', { name: /fetch details/i });
    expect(fetchBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.click(fetchBtn);
    expect(await screen.findByText(/Fetched: Mehta Legal Pvt Ltd \(Active\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/business name/i)).toHaveValue('Mehta Builders');
    expect(screen.getByLabelText(/address/i)).toHaveValue('12 Link Road, Andheri');
    expect(screen.getByLabelText(/state code/i)).toHaveValue('27');
  });

  it('warns when the GSTIN is not active and reports a failed lookup', async () => {
    server.use(
      http.get(apiUrl(`/gstin/${GSTIN}`), () =>
        ok(details({ isActive: false, status: 'Cancelled' }))
      )
    );
    const { user } = setup();
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.click(screen.getByRole('button', { name: /fetch details/i }));
    expect(await screen.findByText('Warning: This GSTIN is Cancelled')).toBeInTheDocument();

    server.use(
      http.get(apiUrl(`/gstin/${GSTIN}`), () =>
        HttpResponse.json({ error: { message: 'GST service down' } }, { status: 502 })
      )
    );
    await user.click(screen.getByRole('button', { name: /fetch details/i }));
    expect(await screen.findByText('GST service down')).toBeInTheDocument();
  });

  it('rejects an invalid email', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/business name/i), 'Acme');
    await user.type(screen.getByLabelText(/email/i), 'nope');
    await user.click(screen.getByRole('button', { name: /^create business$/i }));
    expect(await screen.findByText('Invalid email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
