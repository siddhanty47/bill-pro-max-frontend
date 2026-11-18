import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { PaymentDetailPage } from './PaymentDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Party, Payment } from '../types';

const BASE = '/businesses/biz-1/payments/pay1';

const makePayment = (over: Partial<Payment> = {}): Payment =>
  ({
    _id: 'pay1',
    businessId: 'biz-1',
    type: 'receivable',
    partyId: 'p1',
    billId: 'b1',
    amount: 184200,
    currency: 'INR',
    method: 'bank_transfer',
    reference: 'UTR123',
    date: '2025-11-05T00:00:00.000Z',
    status: 'completed',
    notes: 'Part payment',
    createdAt: '2025-11-05T08:30:00.000Z',
    updatedAt: '2025-11-06T08:30:00.000Z',
    ...over,
  }) as Payment;

function useApi(payment: Payment = makePayment()) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(payment)),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([{ _id: 'p1', name: 'Mehta Builders' }] as Party[])
    )
  );
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/payments/:paymentId" element={<PaymentDetailPage />} />
    </Routes>,
    { preloadedState: signedIn(), route: '/payments/pay1' }
  );
}

describe('PaymentDetailPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading payment…')).toBeInTheDocument();
  });

  it('shows the error', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Payment not found' } },
          { status: 404 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText(/Payment not found/)).toBeInTheDocument();
  });

  it('renders the amount heading, one status chip and the details', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: '₹1,84,200', level: 1 })).toBeVisible();
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Payments' })).toHaveAttribute(
      'href',
      '/payments'
    );
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['About', 'Change history']);

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByText('Received')).toBeVisible();
    expect(within(details).getByText('Bank transfer')).toBeVisible();
    expect(within(details).getByText('UTR123')).toHaveClass('mono');
    expect(within(details).getByText('INR')).toBeVisible();
    expect(within(details).getAllByText('5 Nov 2025')).toHaveLength(2);
    expect(within(details).getByText('6 Nov 2025')).toBeVisible();
    await waitFor(() =>
      expect(within(details).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
        'href',
        '/parties/p1'
      )
    );
    expect(within(details).getByRole('link', { name: 'b1' })).toHaveAttribute('href', '/bills/b1');
    expect(screen.getByText('Part payment')).toBeVisible();
  });

  it('shows Paid for payables, no bill link and placeholders for missing values', async () => {
    useApi(makePayment({ type: 'payable', billId: undefined, reference: undefined, notes: '' }));
    renderPage();
    const details = (await screen.findByRole('heading', { name: 'Details' })).closest('section')!;
    expect(within(details).getByText('Paid')).toBeVisible();
    expect(within(details).queryByText('Bill')).not.toBeInTheDocument();
    expect(within(details).getByText('Not added')).toBeVisible();
    const notes = screen.getByRole('heading', { name: 'Notes' }).closest('section')!;
    expect(within(notes).getByText('Not added')).toBeVisible();
  });

  it('shows zero amounts as ₹0', async () => {
    useApi(makePayment({ amount: 0 }));
    renderPage();
    expect(await screen.findByRole('heading', { name: '₹0', level: 1 })).toBeVisible();
  });

  it('loads the change history', async () => {
    useApi();
    let url = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/payment/pay1'), ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 },
        });
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Change history' }));
    await waitFor(() => expect(url).toContain('/audit-logs/payment/pay1'));
  });
});
