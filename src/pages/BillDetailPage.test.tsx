import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BillDetailPage } from './BillDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import { makeBillNote } from '../test/factories';
import type { Bill, BillNote, Party, Payment } from '../types';

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

/** Like the backend notes list: billId/status/source/type filters. */
function matchNote(n: BillNote, q: URLSearchParams): boolean {
  return (['billId', 'status', 'source', 'type'] as const).every(
    k => !q.get(k) || n[k] === q.get(k)
  );
}

function useApi(bill: Bill = makeBill(), pays: Payment[] = payments, notes: BillNote[] = []) {
  server.use(
    http.get(apiUrl('/businesses/biz-1/bill-notes'), ({ request }) =>
      pagedOk(notes, request, matchNote)
    ),
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

function Where() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div>elsewhere</div>
      <div data-testid="where">{pathname}</div>
      <div data-testid="state">{JSON.stringify(state)}</div>
    </>
  );
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/bills/:billId" element={<BillDetailPage />} />
      <Route path="*" element={<Where />} />
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
    expect(within(row('SGST')).getByText('₹720')).toBeVisible();
    expect(within(row('CGST')).getByText('₹720')).toBeVisible();
    expect(within(row('Total tax')).getByText('₹1,440')).toBeVisible();
    expect(within(row('Discount')).getByText('₹400')).toHaveClass('mono');
    const rateSpan = within(row('SGST')).getByText('(9%)');
    expect(rateSpan).not.toHaveClass('mono');
    expect(rateSpan.closest('td')).not.toHaveClass('mono');
    expect(within(row('Discount')).getByText('(5%)')).toBeVisible();
    expect(within(row('Total')).getByText('₹1,00,000')).toBeVisible();
    expect(within(row('Paid')).getByText('₹40,000')).toBeVisible();
    expect(within(row('Balance due')).getByText('₹60,000')).toBeVisible();
    // Summary lines up with the DetailSection cards; an unpaid balance reads as owed.
    expect(table).toHaveClass('detail');
    expect(within(row('Balance due')).getByText('₹60,000').closest('td')).toHaveClass(
      'tone-negative'
    );
    expect(within(row('Total')).getByText('₹1,00,000').closest('td')?.className).not.toMatch(
      /tone-/
    );
  });

  it('shows a settled balance due in the positive tone', async () => {
    useApi(makeBill({ amountPaid: 100000, status: 'paid' }));
    renderPage();
    const table = await screen.findByRole('table', { name: 'Summary' });
    const balance = within(table).getByText('Balance due').closest('tr')!;
    expect(within(balance).getByText('₹0').closest('td')).toHaveClass('tone-positive');
  });

  it('shows IGST for inter-state and a single tax row without a tax mode', async () => {
    useApi(makeBill({ taxMode: 'inter', igstRate: 18, igstAmount: 1440 }));
    const first = renderPage();
    const table = await screen.findByRole('table', { name: 'Summary' });
    expect(within(table).getByText('(18%)')).toBeVisible();
    expect(within(table).getByText('Total tax')).toBeVisible();
    first.unmount();

    useApi(makeBill({ taxMode: undefined, taxRate: 12 }));
    renderPage();
    const plain = await screen.findByRole('table', { name: 'Summary' });
    await waitFor(() => expect(within(plain).getByText('Tax')).toBeVisible());
    expect(within(plain).getByText('(12%)')).toBeVisible();
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

  it('opens a payment from its date link with the bill payments as context', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Payments/);
    const table = screen.getByRole('table', { name: 'Payments' });
    await user.click(within(table).getByRole('link', { name: '5 Nov 2025' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/payments/pay1');
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '').recordNav).toEqual({
      paths: ['/payments/pay2', '/payments/pay1'],
      index: 1,
    });
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

  it('changes status from the menu, offering only moves the server allows, and alerts on failure', async () => {
    useApi();
    const bodies = capture('patch', `${BASE}/status`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Sent', 'Cancelled']);
    await user.click(screen.getByRole('menuitem', { name: 'Cancelled' }));
    await waitFor(() => expect(bodies).toEqual([{ status: 'cancelled' }]));

    server.use(
      http.patch(apiUrl(`${BASE}/status`), () =>
        HttpResponse.json({ success: false, error: { message: 'Not allowed' } }, { status: 400 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sent' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Not allowed')));
  });

  it('never offers draft or cancelled for an issued bill', async () => {
    useApi(makeBill({ status: 'overdue' }));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'Send email',
      'New credit note',
      'New debit note',
      'Sent',
      'Paid',
      'Partial',
    ]);
  });

  it('hides the actions menu on a cancelled bill', async () => {
    useApi(makeBill({ status: 'cancelled' }));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Download invoice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
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

  const driftOf = (over: Partial<NonNullable<Bill['drift']>> = {}): NonNullable<Bill['drift']> => ({
    delta: { total: 500, subtotal: 400, taxAmount: 100, items: [], transport: 0, damage: 0 },
    detectedAt: '2026-01-01T00:00:00.000Z',
    causes: [
      {
        kind: 'challan',
        id: 'c1',
        label: 'Challan D-0001',
        reason: 'Quantity fixed',
        at: '2026-01-02T00:00:00.000Z',
      },
    ],
    ...over,
  });
  const spans = [
    {
      itemId: 'i1',
      itemName: 'Ladder 1.5m',
      from: '2025-10-03T00:00:00.000Z',
      to: '2025-10-05T00:00:00.000Z',
      minQty: -2,
    },
  ];

  it('shows an out of date notice on a draft and refreshes it', async () => {
    useApi(makeBill({ drift: driftOf() }));
    const bodies = capture('post', `${BASE}/refresh`);
    const { user } = renderPage();

    expect(await screen.findByText('Out of date')).toBeVisible();
    expect(screen.getByText(/The total changes by \+₹500 since this bill was made/)).toBeVisible();
    expect(screen.getByText(/Challan D-0001: Quantity fixed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Regenerate bill' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh bill' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
  });

  it('shows a negative change with its sign', async () => {
    useApi(makeBill({ drift: driftOf({ delta: { ...driftOf().delta, total: -250 } }) }));
    renderPage();
    expect(await screen.findByText(/changes by -₹250/)).toBeVisible();
  });

  it('shows the message when the period has nothing left to bill', async () => {
    useApi(makeBill({ drift: driftOf() }));
    server.use(
      http.post(apiUrl(`${BASE}/refresh`), () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'BILL_PERIOD_EMPTY', message: 'Nothing to bill in this period.' },
          },
          { status: 400 }
        )
      )
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Refresh bill' }));
    expect(await screen.findByText('Nothing to bill in this period.')).toBeVisible();
  });

  it('shows a pending adjustment on an issued bill with no delete or refresh', async () => {
    useApi(
      makeBill({
        status: 'sent',
        pendingAdjustment: { ...driftOf(), amount: -300 },
      })
    );
    const { user } = renderPage();
    expect(await screen.findByText('Pending adjustment -₹300')).toBeVisible();
    expect(
      screen.getByText(/credit or debit note for this amount comes in the next release/)
    ).toBeVisible();
    expect(screen.getByText(/Challan D-0001/)).toBeVisible();
    expect(screen.queryByText('Out of date')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Refresh bill|Regenerate/ })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: /Delete|Regenerate/ })).not.toBeInTheDocument();
  });

  it('lists negative stock on any bill', async () => {
    useApi(makeBill({ status: 'paid', negativeStock: spans }));
    renderPage();
    expect(await screen.findByText('Stock went below zero')).toBeVisible();
    expect(screen.getByText(/billed as 0 on these days/)).toBeVisible();
    expect(screen.getByText(/Ladder 1.5m: 3 Oct 2025 – 5 Oct 2025, lowest count -2/)).toBeVisible();
  });

  it('blocks sending an out of date draft without calling the API', async () => {
    useApi(makeBill({ drift: driftOf() }));
    const sends = capture('post', `${BASE}/send`);
    const refreshes = capture('post', `${BASE}/refresh`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/out of date/i, { selector: 'p' })).toBeVisible();
    expect(sends).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Refresh bill' }));
    await waitFor(() => expect(refreshes).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks before sending a draft with negative stock, then acknowledges', async () => {
    useApi(makeBill({ negativeStock: spans }));
    const bodies = capture('post', `${BASE}/send`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Ladder 1.5m/)).toBeVisible();
    expect(bodies).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(bodies).toEqual([{ acknowledgeNegative: true }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('can back out of the negative stock dialog', async () => {
    useApi(makeBill({ negativeStock: spans }));
    const bodies = capture('post', `${BASE}/send`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('opens the negative stock dialog from a 409 and sends the acknowledgement', async () => {
    useApi();
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl(`${BASE}/send`), async ({ request }) => {
        const body = await request.json().catch(() => null);
        bodies.push(body);
        if (body) return ok(makeBill());
        return HttpResponse.json(
          {
            success: false,
            error: { code: 'NEGATIVE_STOCK_ACK_REQUIRED', details: { negativeStock: spans } },
          },
          { status: 409 }
        );
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Ladder 1.5m/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(bodies).toEqual([null, { acknowledgeNegative: true }]));
  });

  it('opens the out of date dialog from a 409', async () => {
    useApi();
    server.use(
      http.post(apiUrl(`${BASE}/send`), () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'BILL_OUT_OF_DATE', message: 'Refresh this bill first.' },
          },
          { status: 409 }
        )
      )
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    expect(await screen.findByText('Refresh this bill first.')).toBeVisible();
  });

  it('gates marking a draft as sent, but not cancelling it', async () => {
    useApi(makeBill({ negativeStock: spans }));
    const bodies = capture('patch', `${BASE}/status`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelled' }));
    await waitFor(() => expect(bodies).toEqual([{ status: 'cancelled' }]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sent' }));
    await user.click(await screen.findByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(bodies[1]).toEqual({ status: 'sent', acknowledgeNegative: true }));
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

  describe('credit and debit notes', () => {
    const cause = {
      kind: 'challan' as const,
      id: 'c1',
      label: 'Challan D-0001',
      reason: 'Quantity fixed',
      at: '2026-01-02T00:00:00.000Z',
    };
    const draftAuto = (over: Partial<BillNote> = {}) =>
      makeBillNote({
        _id: 'n9',
        billId: 'b1',
        source: 'auto',
        type: 'debit',
        status: 'draft',
        totalAmount: 300,
        causes: [cause],
        ...over,
      });

    it('turns the pending adjustment into the draft auto note with a review link', async () => {
      useApi(
        makeBill({ status: 'sent', pendingAdjustment: { ...driftOf(), amount: 300 } }),
        payments,
        [draftAuto()]
      );
      renderPage();
      expect(await screen.findByText('Draft debit note ₹300')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
        'href',
        '/bill-notes/n9'
      );
      expect(screen.getByText(/Challan D-0001: Quantity fixed/)).toBeVisible();
      expect(screen.queryByText(/Pending adjustment/)).not.toBeInTheDocument();
    });

    it('names a draft credit note by its amount', async () => {
      useApi(makeBill({ status: 'paid', amountPaid: 100000 }), payments, [
        draftAuto({ type: 'credit', totalAmount: 250 }),
      ]);
      renderPage();
      expect(await screen.findByText('Draft credit note ₹250')).toBeVisible();
    });

    it('shows notes and the effective amount in the totals, and the balance from it', async () => {
      useApi(makeBill({ status: 'sent', notesTotal: -1000 }));
      renderPage();
      const table = await screen.findByRole('table', { name: 'Summary' });
      const row = (label: string) => within(table).getByText(label).closest('tr')!;
      expect(within(row('Notes')).getByText('-₹1,000')).toHaveClass('mono');
      expect(within(row('Effective')).getByText('₹99,000')).toBeVisible();
      expect(within(row('Balance due')).getByText('₹59,000')).toBeVisible();
    });

    it('shows a debit total with a plus sign', async () => {
      useApi(makeBill({ status: 'sent', notesTotal: 500 }));
      renderPage();
      const table = await screen.findByRole('table', { name: 'Summary' });
      expect(within(table).getByText('+₹500')).toBeVisible();
      expect(within(table).getByText('₹1,00,500')).toBeVisible();
      expect(within(table).getByText('₹60,500')).toBeVisible();
    });

    it('hides notes and effective rows when the bill has no notes', async () => {
      useApi(makeBill({ status: 'sent', notesTotal: 0 }));
      renderPage();
      const table = await screen.findByRole('table', { name: 'Summary' });
      expect(within(table).queryByText('Effective')).not.toBeInTheDocument();
      expect(within(table).queryByText('Notes')).not.toBeInTheDocument();
    });

    it('lists the notes on an issued bill in a Notes tab', async () => {
      useApi(makeBill({ status: 'sent' }), payments, [
        makeBillNote({
          _id: 'n1',
          billId: 'b1',
          status: 'issued',
          noteNumber: 'CN/2026-27/0001',
          noteDate: '2026-11-21T00:00:00.000Z',
        }),
        draftAuto(),
      ]);
      const { user } = renderPage();
      await openTab(user, /^Notes/);
      const table = screen.getByRole('table', { name: 'Bill notes' });
      const issued = within(table).getByText('CN/2026-27/0001').closest('tr')!;
      expect(within(issued).getByText('-₹1,180')).toBeVisible();
      expect(within(issued).getByText('Issued')).toBeVisible();
      const draft = within(table).getByText('₹300').closest('tr')!;
      expect(within(draft).getByText('Auto')).toBeVisible();
      expect(screen.getByRole('tab', { name: /Notes/ })).toHaveTextContent('2');
    });

    it('offers no notes tab or new-note actions on a draft bill', async () => {
      useApi();
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Summary' });
      expect(screen.queryByRole('tab', { name: /^Notes/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'More actions' }));
      expect(screen.queryByRole('menuitem', { name: /New credit note/ })).not.toBeInTheDocument();
    });

    it('creates a full credit note and opens it', async () => {
      useApi(makeBill({ status: 'sent', notesTotal: -1000 }));
      const bodies: unknown[] = [];
      server.use(
        http.post(apiUrl('/businesses/biz-1/bill-notes'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(makeBillNote({ _id: 'new1', billId: 'b1' }));
        })
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'More actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'New credit note' }));
      const dialog = screen.getByRole('dialog', { name: 'New credit note' });
      await user.click(within(dialog).getByRole('checkbox', { name: 'Credit the full bill' }));
      // Full value = effective amount
      expect(within(dialog).getByText('-₹99,000')).toBeVisible();
      await user.type(within(dialog).getByLabelText(/Reason/), 'Raised in error');
      await user.click(within(dialog).getByRole('button', { name: 'Create note' }));
      await waitFor(() =>
        expect(screen.getByTestId('where')).toHaveTextContent('/bill-notes/new1')
      );
      expect(bodies).toEqual([
        { billId: 'b1', type: 'credit', reason: 'Raised in error', fullValue: true },
      ]);
    });

    it('creates a debit note with lines from the Notes tab', async () => {
      useApi(makeBill({ status: 'paid', amountPaid: 100000 }));
      const bodies: unknown[] = [];
      server.use(
        http.post(apiUrl('/businesses/biz-1/bill-notes'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(makeBillNote({ _id: 'new2', type: 'debit' }));
        })
      );
      const { user } = renderPage();
      await openTab(user, /^Notes/);
      expect(screen.getByText('No notes on this bill')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'New debit note' }));
      const dialog = screen.getByRole('dialog', { name: 'New debit note' });
      expect(
        within(dialog).queryByRole('checkbox', { name: 'Credit the full bill' })
      ).not.toBeInTheDocument();
      await user.type(within(dialog).getByLabelText('Description for line 1'), 'Extra trip');
      await user.type(within(dialog).getByLabelText('Amount for line 1'), '500');
      await user.type(within(dialog).getByLabelText(/Reason/), 'Missed transport');
      await user.click(within(dialog).getByRole('button', { name: 'Create note' }));
      await waitFor(() =>
        expect(screen.getByTestId('where')).toHaveTextContent('/bill-notes/new2')
      );
      expect(bodies).toEqual([
        {
          billId: 'b1',
          type: 'debit',
          reason: 'Missed transport',
          lines: [{ kind: 'other', description: 'Extra trip', amount: 500 }],
        },
      ]);
    });

    it('keeps the new-note dialog open while the note is being created', async () => {
      useApi(makeBill({ status: 'sent' }));
      let release: () => void = () => {};
      server.use(
        http.post(
          apiUrl('/businesses/biz-1/bill-notes'),
          () =>
            new Promise<Response>(resolve => {
              release = () => resolve(ok(makeBillNote({ _id: 'new3' })));
            })
        )
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'More actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'New credit note' }));
      const dialog = screen.getByRole('dialog', { name: 'New credit note' });
      await user.click(within(dialog).getByRole('checkbox', { name: 'Credit the full bill' }));
      await user.type(within(dialog).getByLabelText(/Reason/), 'Raised in error');
      await user.click(within(dialog).getByRole('button', { name: 'Create note' }));
      await waitFor(() =>
        expect(within(dialog).getByRole('button', { name: 'Create note' })).toBeDisabled()
      );
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog', { name: 'New credit note' })).toBeVisible();
      release();
      await waitFor(() =>
        expect(screen.getByTestId('where')).toHaveTextContent('/bill-notes/new3')
      );
    });

    it('shows CREDIT_EXCEEDS_BILL from the server in the form', async () => {
      useApi(makeBill({ status: 'sent' }));
      server.use(
        http.post(apiUrl('/businesses/biz-1/bill-notes'), () =>
          HttpResponse.json(
            {
              success: false,
              error: { code: 'CREDIT_EXCEEDS_BILL', message: 'Credit is more than the bill' },
            },
            { status: 400 }
          )
        )
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'More actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'New credit note' }));
      const dialog = screen.getByRole('dialog', { name: 'New credit note' });
      await user.type(within(dialog).getByLabelText('Description for line 1'), 'Refund');
      await user.type(within(dialog).getByLabelText('Amount for line 1'), '200000');
      await user.type(within(dialog).getByLabelText(/Reason/), 'Goodwill');
      await user.click(within(dialog).getByRole('button', { name: 'Create note' }));
      expect(await within(dialog).findByText('Credit is more than the bill')).toBeVisible();
      expect(screen.getByRole('dialog', { name: 'New credit note' })).toBeVisible();
    });
  });
});
