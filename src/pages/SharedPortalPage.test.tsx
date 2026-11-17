import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { SharedPortalPage } from './SharedPortalPage';
import { renderWithProviders } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';

const info = {
  partyName: 'Mehta Builders',
  partyCode: 'MEHT',
  businessName: 'Patel Scaffold Co.',
  siteCode: 'S1',
  siteName: 'Tower A',
};

const summary = {
  totalOutstanding: 125000,
  totalBilled: 480000,
  totalPaid: 355000,
  totalItemsInUse: 42,
  billCount: 7,
  overdueBills: 2,
  itemsBreakdown: [
    { itemName: 'Cuplock vertical 2m', quantity: 30 },
    { itemName: 'Ledger 1.5m', quantity: 12 },
  ],
};

const challan = {
  _id: 'c1',
  challanNumber: 'CH-001',
  type: 'delivery',
  date: '2025-03-10T00:00:00.000Z',
  agreementId: 'AGR-1',
  items: [
    { itemName: 'Cuplock vertical 2m', quantity: 30 },
    { itemName: 'Ledger 1.5m', quantity: 12 },
  ],
  status: 'confirmed',
};

const bill = {
  _id: 'b1',
  billNumber: 'BILL-001',
  billingPeriod: { start: '2025-03-01T00:00:00.000Z', end: '2025-03-31T00:00:00.000Z' },
  totalAmount: 184200,
  amountPaid: 50000.5,
  status: 'partial',
  dueDate: '2025-04-15T00:00:00.000Z',
};

const payment = {
  _id: 'p1',
  amount: 75000,
  method: 'bank_transfer',
  date: '2025-04-02T00:00:00.000Z',
  status: 'completed',
  reference: 'UTR998877',
  notes: 'March part payment',
};

const page = (totalPages: number, hasNext: boolean) => ({
  page: 1,
  pageSize: 20,
  total: totalPages * 20,
  totalPages,
  hasNext,
  hasPrev: false,
});

const list = <T,>(data: T[], totalPages = 1, hasNext = false) =>
  HttpResponse.json({ success: true, data, pagination: page(totalPages, hasNext) });

function useApi(over: { bills?: unknown[]; payments?: unknown[]; challans?: unknown[] } = {}) {
  server.use(
    http.get(apiUrl('/share/tok'), () => ok(info)),
    http.get(apiUrl('/share/tok/summary'), () => ok(summary)),
    http.get(apiUrl('/share/tok/challans'), () => list(over.challans ?? [challan])),
    http.get(apiUrl('/share/tok/running-items'), () => ok(summary.itemsBreakdown)),
    http.get(apiUrl('/share/tok/bills'), () => list(over.bills ?? [bill])),
    http.get(apiUrl('/share/tok/payments'), () => list(over.payments ?? [payment]))
  );
}

function renderPage(token = 'tok') {
  return renderWithProviders(
    <Routes>
      <Route path="/share/:token" element={<SharedPortalPage />} />
    </Routes>,
    { route: `/share/${token}` }
  );
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

afterEach(() => vi.restoreAllMocks());

describe('SharedPortalPage', () => {
  it('shows the party header and summary figures', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Mehta Builders' })).toBeInTheDocument();
    expect(screen.getByText('Patel Scaffold Co.')).toBeInTheDocument();
    expect(screen.getByText(/Tower A/)).toBeInTheDocument();
    expect(await screen.findByText('₹1,25,000')).toBeInTheDocument();
    expect(screen.getByText('₹4,80,000')).toBeInTheDocument();
    expect(screen.getByText('₹3,55,000')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('Cuplock vertical 2m').length).toBeGreaterThan(0);
    const table = screen.getByRole('table', { name: 'Items currently in use' });
    expect(within(table).getByText('30')).toBeInTheDocument();
  });

  it('lists challans with items and downloads the PDF', async () => {
    useApi();
    let pdfHit = 0;
    server.use(
      http.get(apiUrl('/share/tok/challans/c1/pdf'), () => {
        pdfHit += 1;
        return new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Challans');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('CH-001')).toBeInTheDocument();
    expect(within(table).getByText('10 Mar 2025')).toBeInTheDocument();
    expect(within(table).getByText('Delivery')).toBeInTheDocument();
    expect(within(table).getByText('Cuplock vertical 2m x30, Ledger 1.5m x12')).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: /pdf/i }));
    await waitFor(() => expect(pdfHit).toBe(1));
    await waitFor(() => expect(click).toHaveBeenCalled());
  });

  it('lists bills with exact amounts and downloads the PDF', async () => {
    useApi();
    let pdfHit = 0;
    server.use(
      http.get(apiUrl('/share/tok/bills/b1/pdf'), () => {
        pdfHit += 1;
        return new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Bills');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('BILL-001')).toBeInTheDocument();
    expect(within(table).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(table).getByText('₹50,000.50')).toBeInTheDocument();
    expect(within(table).getByText('Partial')).toBeInTheDocument();
    expect(within(table).getByText('1 Mar 2025 - 31 Mar 2025')).toBeInTheDocument();
    expect(within(table).getByText('15 Apr 2025')).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: /pdf/i }));
    await waitFor(() => expect(pdfHit).toBe(1));
  });

  it('lists payments with method, reference and notes', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Payments');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('₹75,000')).toBeInTheDocument();
    expect(within(table).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(table).getByText('Completed')).toBeInTheDocument();
    expect(within(table).getByText('2 Apr 2025')).toBeInTheDocument();
    expect(within(table).getByText('UTR998877')).toBeInTheDocument();
    expect(within(table).getByText('March part payment')).toBeInTheDocument();
  });

  it('lists running items', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Running items');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ledger 1.5m')).toBeInTheDocument();
    expect(within(table).getByText('12')).toBeInTheDocument();
  });

  it('shows Not added for a payment without reference or notes', async () => {
    useApi({ payments: [{ ...payment, reference: null, notes: null }] });
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Payments');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('Not added')).toHaveLength(2);
  });

  it('shows the phone list alongside the table', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Bills');
    const list = await screen.findByRole('list', { name: 'Bills' });
    expect(within(list).getByText('BILL-001')).toBeInTheDocument();
    const total = within(list).getByText('₹1,84,200');
    const paid = within(list).getByText('₹50,000.50');
    expect(total).toHaveClass('mono');
    expect(paid).toHaveClass('mono');
    // Only the amounts are mono; the words and the due date stay in the body font.
    expect(total.parentElement).toHaveTextContent('Total ₹1,84,200');
    expect(total.parentElement).not.toHaveClass('mono');
    expect(paid.parentElement).toHaveTextContent('Paid ₹50,000.50');
    expect(paid.parentElement).not.toHaveClass('mono');
    expect(within(list).getByText(/^Due /)).not.toHaveClass('mono');
  });

  it('shows Not added for a bill without period or due date, with no dangling Due label', async () => {
    useApi({ bills: [{ ...bill, billingPeriod: null, dueDate: '' }] });
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Bills');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('Not added')).toHaveLength(2);
    expect(within(table).queryByText('-')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Bills' });
    expect(within(list).queryByText(/Due/)).not.toBeInTheDocument();
    expect(within(list).getByText('₹50,000.50')).toBeInTheDocument();
  });

  it('shows the challan phone list', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Challans');
    const list = await screen.findByRole('list', { name: 'Challans' });
    const item = within(list).getAllByRole('listitem')[0];
    expect(within(item).getByText('CH-001')).toBeInTheDocument();
    expect(within(item).getByText('Delivery')).toBeInTheDocument();
    expect(within(item).getByText('Cuplock vertical 2m x30, Ledger 1.5m x12')).toBeInTheDocument();
    expect(within(item).getByText('10 Mar 2025')).toBeInTheDocument();
    expect(
      within(item).getByRole('button', { name: 'Download challan CH-001 PDF' })
    ).toBeInTheDocument();
  });

  it('shows the payment phone list', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Payments');
    const list = await screen.findByRole('list', { name: 'Payments' });
    const item = within(list).getAllByRole('listitem')[0];
    expect(within(item).getByText('₹75,000')).toBeInTheDocument();
    expect(within(item).getByText('Completed')).toBeInTheDocument();
    expect(within(item).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(item).getByText('UTR998877')).toBeInTheDocument();
    expect(item).toHaveTextContent('2 Apr 2025 · UTR998877 · March part payment');
  });

  it('shows the running items phone list', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Running items');
    const list = await screen.findByRole('list', { name: 'Running items' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Cuplock vertical 2m')).toBeInTheDocument();
    expect(within(items[0]).getByText('30')).toBeInTheDocument();
    expect(within(items[1]).getByText('Ledger 1.5m')).toBeInTheDocument();
    expect(within(items[1]).getByText('12')).toBeInTheDocument();
  });

  it('shows empty messages', async () => {
    useApi({ bills: [], payments: [], challans: [] });
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Bills');
    expect(await screen.findByText('No bills found.')).toBeInTheDocument();
    await openTab(user, 'Payments');
    expect(await screen.findByText('No payments found.')).toBeInTheDocument();
    await openTab(user, 'Challans');
    expect(await screen.findByText('No challans found.')).toBeInTheDocument();
  });

  it('pages bills with the same page query', async () => {
    const pages: string[] = [];
    useApi();
    server.use(
      http.get(apiUrl('/share/tok/bills'), ({ request }) => {
        const p = new URL(request.url).searchParams.get('page') ?? '';
        pages.push(p);
        return list([bill], 2, p === '1');
      })
    );
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Mehta Builders' });
    await openTab(user, 'Bills');
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(pages).toEqual(['1', '2']);
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('shows the expired state', async () => {
    server.use(
      http.get(apiUrl('/share/tok/summary'), () => new HttpResponse(null, { status: 410 })),
      http.get(apiUrl('/share/tok'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'SHARE_LINK_EXPIRED', message: 'expired' } },
          { status: 410 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(
      screen.getByText('This share link has expired. Ask the business for a new link.')
    ).toBeInTheDocument();
  });

  it('shows the invalid state', async () => {
    server.use(
      http.get(apiUrl('/share/tok/summary'), () => new HttpResponse(null, { status: 404 })),
      http.get(apiUrl('/share/tok'), () =>
        HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 })
      )
    );
    renderPage();
    expect(await screen.findByText('Invalid link')).toBeInTheDocument();
    expect(screen.getByText(/invalid or has been revoked/)).toBeInTheDocument();
  });
});
