import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PartyDetailPage } from './PartyDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Bill, Party, Payment } from '../types';

const BASE = '/businesses/biz-1/parties/p1';

const makeParty = (over: Partial<Party> = {}): Party =>
  ({
    _id: 'p1',
    businessId: 'biz-1',
    code: 'MEHT',
    name: 'Mehta Builders',
    roles: ['client', 'supplier'],
    contact: {
      person: 'Rakesh Mehta',
      phone: '9820041275',
      address: 'Plot 12, Andheri East',
      gst: '27AABCM1234F1Z5',
      stateCode: '27',
    },
    sites: [
      { code: 'PLOT', address: 'Plot 12, Andheri', stateCode: '27' },
      { code: 'SECT', address: 'Sector 5, Vashi' },
    ],
    agreements: [
      {
        agreementId: 'AG-001',
        siteCode: 'PLOT',
        startDate: '2025-09-01T00:00:00.000Z',
        status: 'active',
        terms: { billingCycle: 'monthly', paymentDueDays: 15 },
        rates: [],
        createdAt: '2025-09-01T00:00:00.000Z',
      },
      {
        agreementId: 'AG-002',
        siteCode: 'SECT',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-06-30T00:00:00.000Z',
        status: 'expired',
        terms: { billingCycle: 'monthly', paymentDueDays: 15 },
        rates: [],
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    isActive: true,
    notes: 'Pays by cheque at month end',
    createdAt: '2025-09-01T00:00:00.000Z',
    updatedAt: '2025-11-16T00:00:00.000Z',
    ...over,
  }) as Party;

const bill = (over: Partial<Bill>): Bill =>
  ({
    _id: 'b1',
    businessId: 'biz-1',
    billNumber: 'B-0001',
    partyId: 'p1',
    agreementId: 'AG-001',
    billingPeriod: { start: '2025-09-01T00:00:00.000Z', end: '2025-09-30T00:00:00.000Z' },
    billDate: '2025-09-30T00:00:00.000Z',
    items: [],
    totalAmount: 184200,
    status: 'sent',
    ...over,
  }) as Bill;

const bills = [
  bill({}),
  bill({
    _id: 'b2',
    billNumber: 'B-0002',
    agreementId: 'AG-002',
    billDate: '2025-10-31T00:00:00.000Z',
    totalAmount: 99.5,
  }),
];

const payments = [
  {
    _id: 'pay1',
    businessId: 'biz-1',
    type: 'receivable',
    partyId: 'p1',
    billId: 'b1',
    amount: 50000,
    currency: 'INR',
    method: 'bank_transfer',
    reference: 'UTR123',
    date: '2025-10-05T00:00:00.000Z',
    status: 'completed',
    createdAt: '2025-10-05T00:00:00.000Z',
    updatedAt: '2025-10-05T00:00:00.000Z',
  },
] as Payment[];

const BY_SITE = {
  partyId: 'p1',
  sites: [
    {
      siteCode: null,
      address: 'Plot 12, Andheri East',
      isDefault: true,
      opening: 50,
      billed: 0,
      received: 20,
      outstanding: 30,
    },
    {
      siteCode: 'PLOT',
      address: 'Plot 12, Andheri',
      isDefault: false,
      opening: 1000,
      billed: 300,
      received: 100,
      outstanding: 1200,
    },
    {
      siteCode: 'SECT',
      address: 'Sector 5, Vashi',
      isDefault: false,
      opening: -200,
      billed: 400,
      received: 70,
      outstanding: 130,
    },
  ],
  total: { opening: 850, billed: 700, received: 190, outstanding: 1360 },
};

const paged = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    data,
    pagination: { page: 1, pageSize: 100, total: data.length, totalPages: 1 },
  });

function useApi(party: Party = makeParty()) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(party)),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => paged([])),
    http.get(apiUrl('/businesses/biz-1/bills'), () => paged(bills)),
    http.get(apiUrl('/businesses/biz-1/payments'), () => paged(payments)),
    http.get(apiUrl(`${BASE}/outstanding-by-site`), () => ok(BY_SITE)),
    http.get(apiUrl('/businesses/biz-1/parties/outstanding'), () =>
      ok({
        totalOutstanding: 45000,
        parties: [
          {
            partyId: party._id,
            partyName: party.name,
            partyCode: party.code,
            openingBalance: party.openingBalance ?? 0,
            totalBilled: 0,
            totalReceived: 0,
            outstanding: 45000,
          },
        ],
        currency: 'INR',
      })
    )
  );
}

/** Captures PATCH bodies sent to a path and replies with the party. */
function capturePatch(path: string) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(apiUrl(path), async ({ request }) => {
      bodies.push(await request.json());
      return ok(makeParty());
    })
  );
  return bodies;
}

function Where() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div data-testid="where">{pathname}</div>
      <div data-testid="state">{JSON.stringify(state)}</div>
    </>
  );
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/parties/:partyId" element={<PartyDetailPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn(), route: '/parties/p1' }
  );
}

/**
 * The statement PDF endpoint stores a Blob in RTK Query state (existing app
 * behaviour); silence only RTK's dev "non-serializable" warning about it.
 */
function allowBlobInStore() {
  const original = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('non-serializable')) return;
    original(...args);
  });
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: RegExp) {
  await user.click(await screen.findByRole('tab', { name }));
}

afterEach(() => vi.restoreAllMocks());

describe('PartyDetailPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading party…')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Party not found' } },
          { status: 404 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText(/Party not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again|Retry/ })).toBeInTheDocument();
  });

  it('renders the header, tabs with counts and the about tab', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Mehta Builders', level: 1 })).toBeVisible();
    expect(screen.queryByText(/^Party ·/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Parties' })).toHaveAttribute(
      'href',
      '/parties'
    );

    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual([
      'About',
      'Sites & agreements 2',
      expect.stringMatching(/^Bills/),
      expect.stringMatching(/^Payments/),
      'Statements',
      'Share links',
      'Change history',
    ]);
    expect(await screen.findByRole('tab', { name: 'Bills 2' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Payments 1' })).toBeInTheDocument();

    const contact = screen.getByRole('heading', { name: 'Contact' }).closest('section')!;
    expect(within(contact).getByText('Contact person')).toBeInTheDocument();
    expect(within(contact).getByText('State code')).toBeInTheDocument();
    expect(within(contact).getByRole('button', { name: /9820041275/ })).toHaveClass('mono');
    expect(
      within(contact).getByRole('button', { name: /Email.*Not added|Not added/ })
    ).toBeVisible();
    expect(screen.getByText('Pays by cheque at month end')).toBeInTheDocument();

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).getByText('Client, Supplier')).toBeInTheDocument();
    expect(within(details).getByText('1 Sep 2025')).toBeInTheDocument();
    expect(within(details).getByText('16 Nov 2025')).toBeInTheDocument();
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
  });

  it('saves top-level, contact and notes edits with the same payloads', async () => {
    useApi();
    const bodies = capturePatch(BASE);
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: /^Mehta Builders/ }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Mehta Infra{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(1));

    await user.click(await screen.findByRole('button', { name: /9820041275/ }));
    const phone = screen.getByRole('textbox', { name: 'Phone' });
    await user.clear(phone);
    await user.type(phone, '9000000001{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(2));

    await user.click(await screen.findByRole('button', { name: /Pays by cheque/ }));
    const notes = screen.getByRole('textbox');
    await user.clear(notes);
    await user.type(notes, 'Cash only');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(bodies[0]).toEqual({ name: 'Mehta Infra' });
    expect(bodies[1]).toEqual({
      contact: {
        person: 'Rakesh Mehta',
        phone: '9000000001',
        address: 'Plot 12, Andheri East',
        gst: '27AABCM1234F1Z5',
        stateCode: '27',
      },
    });
    expect(bodies[2]).toEqual({ notes: 'Cash only' });
  });

  it('shows the balance and saves the opening balance and its date', async () => {
    useApi(makeParty({ openingBalance: 12500.5, openingBalanceDate: '2026-03-31T00:00:00.000Z' }));
    const bodies = capturePatch(BASE);
    const { user } = renderPage();

    const balance = (await screen.findByRole('heading', { name: 'Balance' })).closest('section')!;
    expect(await within(balance).findByText('₹45,000')).toBeInTheDocument();
    expect(within(balance).getByText('₹12,500.50')).toBeInTheDocument();
    expect(within(balance).getByText(/^31 Mar/)).toBeInTheDocument();

    await user.click(within(balance).getByRole('button', { name: /12,500/ }));
    const amount = screen.getByRole('spinbutton', { name: 'Opening balance' });
    await user.clear(amount);
    await user.type(amount, '-500{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ openingBalance: -500 });
  });

  it('shows "Not added" for a party without an opening balance', async () => {
    useApi();
    renderPage();

    const balance = (await screen.findByRole('heading', { name: 'Balance' })).closest('section')!;
    expect(
      within(balance).getByRole('button', { name: /Opening balance.*Not added|Not added/ })
    ).toBeVisible();
  });

  it('lists sites and agreements and edits a site inline', async () => {
    useApi();
    const bodies = capturePatch(`${BASE}/sites/:code`);
    const { user } = renderPage();
    await openTab(user, /Sites & agreements/);

    const sites = screen.getByRole('table', { name: 'Sites' });
    const plot = within(sites).getByRole('row', { name: /PLOT/ });
    expect(within(plot).getByText('PLOT')).toHaveClass('mono');

    await user.click(within(plot).getByRole('button', { name: /Plot 12, Andheri/ }));
    const address = within(plot).getByRole('textbox', { name: 'Address' });
    await user.clear(address);
    await user.type(address, '  Plot 14  {Enter}');
    await waitFor(() => expect(bodies).toEqual([{ address: 'Plot 14' }]));

    await user.click(await within(plot).findByRole('button', { name: /27/ }));
    await user.clear(within(plot).getByRole('textbox', { name: 'State code' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ address: 'Plot 14' }, {}]));

    const agreements = screen.getByRole('table', { name: 'Agreements' });
    const ag1 = within(agreements).getByRole('row', { name: /AG-001/ });
    expect(within(ag1).getByRole('link', { name: 'AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(within(ag1).getByText('Active')).toBeInTheDocument();
    expect(within(ag1).getByText('1 Sep 2025')).toBeInTheDocument();
    const ag2 = within(agreements).getByRole('row', { name: /AG-002/ });
    expect(within(ag2).getByText('30 Jun 2025')).toBeInTheDocument();
    await user.click(within(ag2).getByText('SECT'));
    expect(screen.getByTestId('where')).toHaveTextContent('/agreements/AG-002');
  });

  it('opens the add site and add agreement modals', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /Sites & agreements/);

    await user.click(screen.getByRole('button', { name: 'Add site' }));
    expect(screen.getByRole('dialog', { name: 'Add site to Mehta Builders' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add agreement' }));
    expect(
      screen.getByRole('dialog', { name: 'Add agreement for Mehta Builders' })
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows empty states for a party with no sites or agreements', async () => {
    useApi(makeParty({ sites: [], agreements: [] }));
    const { user } = renderPage();
    await openTab(user, /Sites & agreements/);
    expect(screen.getAllByText('No sites yet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No agreements yet').length).toBeGreaterThan(0);
  });

  it('lists bills newest first, filters by site and opens a bill', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /Bills/);

    const table = await screen.findByRole('table', { name: 'Bills' });
    const numbers = () =>
      within(table)
        .queryAllByRole('link')
        .map(l => l.textContent);
    await waitFor(() => expect(numbers()).toEqual(['B-0002', 'B-0001']));
    const b1 = within(table).getByRole('row', { name: /B-0001/ });
    expect(within(b1).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(b1).getByText('30 Sep 2025')).not.toHaveClass('mono');
    expect(within(b1).getByText('1 Sep 2025 – 30 Sep 2025')).not.toHaveClass('mono');
    expect(within(b1).getByText('₹1,84,200')).toHaveClass('mono');
    expect(within(b1).getByText('AG-001 / PLOT')).toBeInTheDocument();
    expect(
      within(within(table).getByRole('row', { name: /B-0002/ })).getByText('₹99.50')
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Site' }), 'PLOT');
    expect(numbers()).toEqual(['B-0001']);

    await user.click(within(table).getByText('₹1,84,200'));
    expect(screen.getByTestId('where')).toHaveTextContent('/bills/b1');
  });

  it('opens a bill with the party bills as the prev/next context', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /Bills/);
    const table = await screen.findByRole('table', { name: 'Bills' });
    await waitFor(() => expect(within(table).getAllByRole('link')).toHaveLength(2));
    await user.click(within(table).getByRole('row', { name: /B-0001/ }));
    const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
    expect(recordNav.paths.length).toBe(2);
    expect(recordNav.paths).toContain('/bills/b1');
    expect(recordNav.paths[recordNav.index]).toBe('/bills/b1');
  });

  it('opens a payment with the party payments as record context', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /Payments/);
    const table = await screen.findByRole('table', { name: 'Payments' });
    await user.click(await within(table).findByText('UTR123'));
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '').recordNav.paths).toContain(
      '/payments/pay1'
    );
  });

  it('lists payments and links to the bill and the payment', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /Payments/);

    const table = await screen.findByRole('table', { name: 'Payments' });
    const row = await within(table).findByRole('row', { name: /UTR123/ });
    expect(within(row).getByText('₹50,000')).toBeInTheDocument();
    expect(within(row).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).getByText('5 Oct 2025')).toBeInTheDocument();
    expect(within(row).getByText('PLOT')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'View bill' })).toHaveAttribute(
      'href',
      '/bills/b1'
    );
    await user.click(within(row).getByText('UTR123'));
    expect(screen.getByTestId('where')).toHaveTextContent('/payments/pay1');
  });

  it('previews and downloads a statement with the chosen parameters', async () => {
    useApi();
    allowBlobInStore();
    const urls: string[] = [];
    server.use(
      http.get(apiUrl(`${BASE}/statements/data`), ({ request }) => {
        urls.push(request.url);
        return ok({
          type: 'bills',
          business: { name: 'Patel Scaffold' },
          party: { name: 'Mehta Builders', code: 'MEHT' },
          period: { from: '2025-09-01', to: '2025-09-30' },
          bills: [],
          totals: {},
          currency: 'INR',
        });
      }),
      http.get(apiUrl(`${BASE}/statements/pdf`), ({ request }) => {
        urls.push(request.url);
        return new HttpResponse('%PDF', {
          headers: { 'Content-Type': 'application/pdf' },
        });
      })
    );
    const createObjectURL = vi.fn(() => 'blob:statement');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user, unmount } = renderPage();
    await openTab(user, /Statements/);

    const preview = screen.getByRole('button', { name: 'Preview' });
    const download = screen.getByRole('button', { name: 'Download PDF' });
    expect(preview).toBeDisabled();
    expect(download).toBeDisabled();
    expect(preview).toHaveAccessibleDescription('Pick both dates');
    expect(download).toHaveAccessibleDescription('Pick both dates');
    expect(screen.getByLabelText('From')).not.toHaveClass('mono');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'bills');
    await user.type(screen.getByLabelText('From'), '2025-09-01');
    await user.type(screen.getByLabelText('To'), '2025-09-30');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Site or agreement' }),
      'agreement:AG-001'
    );
    expect(screen.queryByText('Pick both dates')).not.toBeInTheDocument();
    expect(preview).not.toHaveAccessibleDescription();

    await user.click(preview);
    expect(await screen.findByText('No bills found for this period.')).toBeInTheDocument();

    await user.click(download);
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:statement');

    const query = 'type=bills&from=2025-09-01&to=2025-09-30&agreementId=AG-001';
    expect(urls).toEqual([
      apiUrl(`${BASE}/statements/data?${query}`),
      apiUrl(`${BASE}/statements/pdf?${query}`),
    ]);
    unmount();
  });

  it('alerts when a statement fails', async () => {
    useApi(makeParty({ agreements: [] }));
    allowBlobInStore();
    server.use(
      http.get(apiUrl(`${BASE}/statements/data`), () =>
        HttpResponse.json({ success: false, error: { message: 'Bad range' } }, { status: 400 })
      ),
      http.get(apiUrl(`${BASE}/statements/pdf`), () =>
        HttpResponse.json({ success: false, error: { message: 'Bad range' } }, { status: 400 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user, unmount } = renderPage();
    await openTab(user, /Statements/);
    expect(screen.queryByRole('combobox', { name: 'Agreement' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('From'), '2025-09-01');
    await user.type(screen.getByLabelText('To'), '2025-09-30');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
    unmount();
  });

  it('shows share links and change history in their tabs', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl(`${BASE}/share-links`), () => ok([])),
      http.get(apiUrl('/businesses/biz-1/audit-logs/party/p1'), ({ request }) => {
        historyUrl = request.url;
        return paged([]);
      })
    );
    const { user } = renderPage();
    await openTab(user, /Share links/);
    expect(screen.getByRole('heading', { name: 'New share link' })).toBeInTheDocument();
    expect(await screen.findAllByText('No share links yet')).not.toHaveLength(0);

    await openTab(user, /Change history/);
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/party/p1'));
  });

  it('shows what the party owes per site, default site first, with the total', async () => {
    useApi();
    renderPage();

    const table = await screen.findByRole('table', { name: 'Outstanding by site' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Default site (party address)');
    expect(rows[1]).toHaveTextContent('₹30');
    expect(within(table).getByRole('row', { name: /PLOT/ })).toHaveTextContent('₹1,200');
    expect(within(table).getByRole('row', { name: /^Total/ })).toHaveTextContent('₹1,360');
  });

  it('scopes a statement to one site, and to the default site', async () => {
    useApi();
    const urls: string[] = [];
    server.use(
      http.get(apiUrl(`${BASE}/statements/data`), ({ request }) => {
        urls.push(request.url);
        return ok({
          type: 'bills',
          business: { name: 'Patel Scaffold' },
          party: { name: 'Mehta Builders', code: 'MEHT' },
          period: { from: '2025-09-01', to: '2025-09-30' },
          bills: [],
          totals: {},
          currency: 'INR',
        });
      })
    );
    const { user } = renderPage();
    await openTab(user, /Statements/);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'bills');
    await user.type(screen.getByLabelText('From'), '2025-09-01');
    await user.type(screen.getByLabelText('To'), '2025-09-30');
    const scope = screen.getByRole('combobox', { name: 'Site or agreement' });

    await user.selectOptions(scope, 'site:SECT');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(urls).toHaveLength(1));
    await user.selectOptions(scope, 'site:@default');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(urls).toHaveLength(2));

    expect(new URL(urls[0]).searchParams.get('siteCode')).toBe('SECT');
    expect(new URL(urls[1]).searchParams.get('siteCode')).toBe('@default');
    expect(new URL(urls[1]).searchParams.get('agreementId')).toBeNull();
  });

  it('does not offer inline editing of an opening balance split across sites', async () => {
    useApi(
      makeParty({
        openingBalance: 1000,
        openingBalanceSites: [{ siteCode: 'PLOT', amount: 1000 }],
      })
    );
    renderPage();

    const balance = (await screen.findByRole('heading', { name: 'Balance' })).closest('section')!;
    expect(within(balance).getByText('₹1,000')).toBeInTheDocument();
    expect(within(balance).queryByRole('button', { name: /1,000/ })).not.toBeInTheDocument();
  });
});
