import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { BillDetailPage } from './BillDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Bill, Party, Payment } from '../types';

const BASE = '/businesses/biz-1/bills/b1';

const makeBill = (over: Partial<Bill> = {}): Bill =>
  ({
    _id: 'b1',
    businessId: 'biz-1',
    billNumber: 'INV-2026-27-0007',
    partyId: 'p1',
    agreementId: 'AG-001',
    billingPeriod: { start: '2025-10-01T00:00:00.000Z', end: '2025-10-31T00:00:00.000Z' },
    billDate: '2025-11-01T00:00:00.000Z',
    items: [
      {
        itemId: 'i1',
        itemName: 'Ladder 1.5m',
        quantity: 10,
        ratePerDay: 12.5,
        totalDays: 30,
        amount: 3750,
      },
      {
        itemId: 'i2',
        itemName: 'Prop 3m',
        quantity: 5,
        ratePerDay: 20,
        totalDays: 30,
        amount: 3000,
      },
    ],
    subtotal: 8000,
    taxMode: 'intra',
    sgstRate: 9,
    cgstRate: 9,
    sgstAmount: 720,
    cgstAmount: 720,
    taxAmount: 1440,
    discountRate: 5,
    discountAmount: 400,
    totalAmount: 100000,
    currency: 'INR',
    status: 'draft',
    dueDate: '2025-11-15T00:00:00.000Z',
    amountPaid: 40000,
    notes: 'Pay by cheque',
    transportationCharges: 500,
    damageCharges: 750,
    damageItems: [
      {
        itemId: 'i1',
        itemName: 'Ladder 1.5m',
        quantity: 5,
        damageRate: 150,
        amount: 750,
        note: 'Bent rung',
        challanNumber: 'R-0003',
      },
    ],
    transportationBreakup: [
      {
        challanNumber: 'D-0001',
        challanType: 'delivery',
        cartageCharge: 200,
        loadingCharge: 50,
        unloadingCharge: 50,
        totalCharge: 300,
      },
      {
        challanNumber: 'R-0003',
        challanType: 'return',
        cartageCharge: 200,
        loadingCharge: 0,
        unloadingCharge: 0,
        totalCharge: 200,
      },
    ],
    createdAt: '2025-11-01T08:30:00.000Z',
    updatedAt: '2025-11-02T08:30:00.000Z',
    ...over,
  }) as Bill;

const payments = [
  {
    _id: 'pay1',
    amount: 10000,
    method: 'cash',
    status: 'completed',
    date: '2025-11-05T00:00:00.000Z',
  },
  {
    _id: 'pay2',
    amount: 30000,
    method: 'bank_transfer',
    status: 'pending',
    reference: 'UTR123',
    date: '2025-11-09T00:00:00.000Z',
  },
] as Payment[];

const paged = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    data,
    pagination: { page: 1, pageSize: 100, total: data.length, totalPages: 1 },
  });

function useApi(bill: Bill = makeBill(), pays: Payment[] = payments) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(bill)),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([{ _id: 'p1', name: 'Mehta Builders' }] as Party[])
    ),
    http.get(apiUrl('/businesses/biz-1/payments/bill/b1'), () => paged(pays)),
    http.get(apiUrl('/businesses/biz-1/payments'), () => paged(pays))
  );
}

/** Captures bodies sent with `method` to `path`. */
function capture(method: 'patch' | 'post', path: string) {
  const bodies: unknown[] = [];
  server.use(
    http[method](apiUrl(path), async ({ request }) => {
      bodies.push(await request.json().catch(() => null));
      return ok(makeBill());
    })
  );
  return bodies;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/bills/:billId" element={<BillDetailPage />} />
      <Route path="*" element={<div>elsewhere</div>} />
    </Routes>,
    { preloadedState: signedIn(), route: '/bills/b1' }
  );
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: RegExp) {
  await user.click(await screen.findByRole('tab', { name }));
}

/** The PDF endpoint stores a Blob in RTK Query state; silence only that dev warning. */
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (String(args[0]).includes('non-serializable')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

afterEach(() => vi.restoreAllMocks());

describe('BillDetailPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading bill…')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json({ success: false, error: { message: 'Bill not found' } }, { status: 404 })
      )
    );
    renderPage();
    expect(await screen.findByText(/Bill not found/)).toBeInTheDocument();
  });

  it('renders header, tabs with counts, billing period, notes and the details sidebar', async () => {
    useApi();
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'INV-2026-27-0007', level: 1 })
    ).toBeVisible();
    expect(screen.getAllByText('Draft')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Bills' })).toHaveAttribute('href', '/bills');
    await waitFor(() =>
      expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
        'About',
        'Line items 2',
        'Payments 2',
        'Change history',
      ])
    );

    const period = screen.getByRole('heading', { name: 'Billing period' }).closest('section')!;
    expect(within(period).getByText('1 Oct 2025')).toBeVisible();
    expect(within(period).getByText('31 Oct 2025')).toBeVisible();
    expect(within(period).getByText('1 Nov 2025')).toBeVisible();
    expect(screen.getByText('Pay by cheque')).toBeInTheDocument();

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).getByText('INV-2026-27-0007')).toHaveClass('mono');
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(within(details).getByRole('link', { name: 'AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(within(details).getByText('15 Nov 2025')).toBeVisible();
    expect(within(details).getByText('INR')).toBeVisible();
  });

  it('renders the summary totals from the fixture', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table', { name: 'Summary' });
    const row = (label: string) => within(table).getByText(label).closest('tr')!;
    expect(within(row('Rental subtotal')).getByText('₹6,750')).toHaveClass('mono');
    expect(within(row('Transportation')).getByText('₹500')).toBeVisible();
    expect(within(row('Damage charges')).getByText('₹750')).toBeVisible();
    expect(within(row('Subtotal')).getByText('₹8,000')).toBeVisible();
    expect(within(row('SGST')).getByText('₹720 (9%)')).toBeVisible();
    expect(within(row('CGST')).getByText('₹720 (9%)')).toBeVisible();
    expect(within(row('Total tax')).getByText('₹1,440')).toBeVisible();
    expect(within(row('Discount')).getByText('₹400 (5%)')).toBeVisible();
    expect(within(row('Total')).getByText('₹1,00,000')).toBeVisible();
    expect(within(row('Paid')).getByText('₹40,000')).toBeVisible();
    expect(within(row('Balance due')).getByText('₹60,000')).toBeVisible();
  });

  it('shows IGST for inter-state and a single tax row without a tax mode', async () => {
    useApi(makeBill({ taxMode: 'inter', igstRate: 18, igstAmount: 1440 }));
    const first = renderPage();
    const table = await screen.findByRole('table', { name: 'Summary' });
    expect(within(table).getByText('₹1,440 (18%)')).toBeVisible();
    expect(within(table).getByText('Total tax')).toBeVisible();
    first.unmount();

    useApi(makeBill({ taxMode: undefined, taxRate: 12 }));
    renderPage();
    const plain = await screen.findByRole('table', { name: 'Summary' });
    await waitFor(() => expect(within(plain).getByText('Tax')).toBeVisible());
    expect(within(plain).getByText('₹1,440 (12%)')).toBeVisible();
    expect(within(plain).queryByText('Total tax')).not.toBeInTheDocument();
  });

  it('lists line, damage and transportation items with mono amounts', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Line items/);

    const items = screen.getByRole('table', { name: 'Line items' });
    const ladder = within(items).getByRole('row', { name: /Ladder 1.5m/ });
    expect(within(ladder).getByText('₹12.50').closest('td')).toHaveClass('mono', 'right');
    expect(within(ladder).getByText('₹3,750')).toBeVisible();

    const damage = screen.getByRole('table', { name: 'Damage items' });
    expect(within(damage).getByText('R-0003')).toHaveClass('mono');
    expect(within(damage).getByText('Bent rung')).toBeVisible();

    const transport = screen.getByRole('table', { name: 'Transportation breakup' });
    expect(within(transport).getByText('Delivery')).toBeVisible();
    expect(within(transport).getByText('Return')).toBeVisible();
    const total = screen.getByText('Total', { selector: 'strong' }).closest('p')!;
    expect(within(total).getByText('₹500')).toHaveClass('mono');
  });

  it('hides damage and transport cards when the bill has none', async () => {
    useApi(makeBill({ damageItems: [], transportationBreakup: undefined }));
    const { user } = renderPage();
    await openTab(user, /^Line items/);
    expect(screen.queryByRole('table', { name: 'Damage items' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Transportation breakup' })).not.toBeInTheDocument();
  });

  it('lists payments newest first and links to each payment', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Payments/);
    const table = screen.getByRole('table', { name: 'Payments' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('9 Nov 2025');
    expect(rows[0]).toHaveTextContent('Bank transfer');
    expect(rows[0]).toHaveTextContent('UTR123');
    expect(rows[1]).toHaveTextContent('5 Nov 2025');
    expect(within(rows[0]).getByRole('link', { name: '9 Nov 2025' })).toHaveAttribute(
      'href',
      '/payments/pay2'
    );
    expect(within(rows[0]).getByText('₹30,000')).toHaveClass('mono');
  });

  it('shows an empty state when there are no payments', async () => {
    useApi(makeBill(), []);
    const { user } = renderPage();
    await openTab(user, /^Payments/);
    expect(await screen.findByText('No payments recorded for this bill')).toBeVisible();
  });

  it('sends the email as the primary action on a draft', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/send`);
    const { user } = renderPage();
    const send = await screen.findByRole('button', { name: 'Send email' });
    expect(send).toHaveClass('primary');
    expect(screen.getByRole('button', { name: 'Download invoice' })).not.toHaveClass('primary');
    await user.click(send);
    await waitFor(() => expect(bodies).toHaveLength(1));
  });

  it('alerts when sending fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl(`${BASE}/send`), () =>
        HttpResponse.json({ success: false, error: { message: 'SMTP down' } }, { status: 500 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('SMTP down')));
  });

  it('makes Mark paid primary for sent bills and sends the paid status', async () => {
    useApi(makeBill({ status: 'sent' }));
    const bodies = capture('patch', `${BASE}/status`);
    const { user } = renderPage();
    const markPaid = await screen.findByRole('button', { name: 'Mark paid' });
    expect(markPaid).toHaveClass('primary');
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
    await user.click(markPaid);
    await waitFor(() => expect(bodies).toEqual([{ status: 'paid' }]));

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Send email' })).toBeInTheDocument();
  });

  it('makes Download invoice primary for paid bills and offers no email', async () => {
    useApi(makeBill({ status: 'paid' }));
    const { user } = renderPage();
    expect(await screen.findByRole('button', { name: 'Download invoice' })).toHaveClass('primary');
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Send email' })).not.toBeInTheDocument();
  });

  it('changes status from the menu, excluding the current status, and alerts on failure', async () => {
    useApi();
    const bodies = capture('patch', `${BASE}/status`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Draft' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Cancelled' }));
    await waitFor(() => expect(bodies).toEqual([{ status: 'cancelled' }]));

    server.use(
      http.patch(apiUrl(`${BASE}/status`), () =>
        HttpResponse.json({ success: false, error: { message: 'Not allowed' } }, { status: 400 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Overdue' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Not allowed')));
  });

  it('downloads the PDF with the invoice filename', async () => {
    useApi();
    let pdfRequests = 0;
    server.use(
      http.get(apiUrl(`${BASE}/pdf`), () => {
        pdfRequests += 1;
        return new HttpResponse('%PDF', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    const createObjectURL = vi.fn(() => 'blob:bill');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      names.push(this.download);
    });
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Download invoice' }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:bill'));
    expect(pdfRequests).toBe(1);
    expect(names).toEqual(['invoice-INV-2026-27-0007.pdf']);
  });

  it('alerts when the PDF fails', async () => {
    useApi();
    server.use(
      http.get(apiUrl(`${BASE}/pdf`), () =>
        HttpResponse.json({ success: false, error: { message: 'PDF broke' } }, { status: 500 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Download invoice' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.any(String)));
  });

  it('regenerates a stale bill: force-delete, generate with the same inputs, back to the list', async () => {
    useApi(makeBill({ isStale: true, taxRate: 18, notes: 'Pay by cheque' }));
    let deleteUrl = '';
    server.use(
      http.delete(apiUrl(BASE), ({ request }) => {
        deleteUrl = request.url;
        return ok(null);
      })
    );
    const bodies = capture('post', '/businesses/biz-1/bills/generate');
    const { user } = renderPage();

    expect(await screen.findByText('Stale bill')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Regenerate bill' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(deleteUrl).toContain('force=true');
    expect(bodies[0]).toMatchObject({
      billDate: '2025-11-01T00:00:00.000Z',
      partyId: 'p1',
      agreementId: 'AG-001',
      billingPeriod: { start: '2025-10-01T00:00:00.000Z', end: '2025-10-31T00:00:00.000Z' },
      taxMode: 'intra',
      sgstRate: 9,
      cgstRate: 9,
      discountRate: 5,
      notes: 'Pay by cheque',
    });
    expect(await screen.findByText('elsewhere')).toBeInTheDocument();
  });

  it('keeps the stale banner usable when regeneration fails', async () => {
    useApi(makeBill({ isStale: true }));
    server.use(
      http.delete(apiUrl(BASE), () =>
        HttpResponse.json({ success: false, error: { message: 'No' } }, { status: 500 })
      )
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Regenerate bill' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Regenerate bill' })).toBeEnabled()
    );
    expect(screen.queryByText('elsewhere')).not.toBeInTheDocument();
  });

  it('loads the change history for the bill', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/bill/b1'), ({ request }) => {
        historyUrl = request.url;
        return paged([]);
      })
    );
    const { user } = renderPage();
    await openTab(user, /Change history/);
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/bill/b1'));
  });
});
