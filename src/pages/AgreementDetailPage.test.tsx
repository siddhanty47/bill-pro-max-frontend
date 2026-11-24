import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AgreementDetailPage } from './AgreementDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { AgreementRateWithItem, AgreementWithParty, Challan, ItemWithParty } from '../types';

const BASE = '/businesses/biz-1/agreements/AG-001';

const makeAgreement = (over: Partial<AgreementWithParty> = {}): AgreementWithParty => ({
  agreementId: 'AG-001',
  siteCode: 'S1',
  partyId: 'p1',
  partyName: 'Mehta Builders',
  startDate: '2025-04-01T00:00:00.000Z',
  endDate: undefined,
  status: 'active',
  terms: {
    billingCycle: 'monthly',
    paymentDueDays: 30,
    securityDeposit: 50000,
    deliveryCartage: 1500,
    returnCartage: undefined,
  },
  rates: [{ itemId: 'i1', ratePerDay: 5, openingBalance: 0 }],
  createdAt: '2025-03-20T10:00:00.000Z',
  ...over,
});

const rates: AgreementRateWithItem[] = [
  {
    itemId: 'i1',
    itemCode: 'LAD',
    itemName: 'Ladder 1.5m',
    itemCategory: 'Ladders',
    ratePerDay: 5,
    openingBalance: 10,
  },
  {
    itemId: 'i2',
    itemCode: 'PRP',
    itemName: 'Prop 3m',
    itemCategory: 'Props',
    ratePerDay: 1250.5,
    openingBalance: 0,
  },
];

const itemsAtSite: ItemWithParty[] = [{ itemId: 'i1', itemName: 'Ladder 1.5m', quantity: 24 }];

const challans = [
  {
    _id: 'c1',
    agreementId: 'AG-001',
    challanNumber: 'D-2026-27-0001',
    type: 'delivery',
    date: '2025-11-10T00:00:00.000Z',
    items: [{}, {}],
    status: 'confirmed',
  },
  {
    _id: 'c2',
    agreementId: 'AG-001',
    challanNumber: 'R-2026-27-0002',
    type: 'return',
    date: '2025-11-12T00:00:00.000Z',
    items: [{}],
    status: 'draft',
  },
] as unknown as Challan[];

const paged = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    data,
    pagination: { page: 1, pageSize: 100, total: data.length, totalPages: 1 },
  });

function useApi(opts: { agreement?: AgreementWithParty; rates?: AgreementRateWithItem[] } = {}) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(opts.agreement ?? makeAgreement())),
    http.get(apiUrl(`${BASE}/rates`), () => ok(opts.rates ?? rates)),
    http.get(apiUrl('/businesses/biz-1/challans/items-with-party/p1'), () => ok(itemsAtSite)),
    http.get(apiUrl('/businesses/biz-1/challans'), () => paged(challans)),
    http.get(apiUrl('/businesses/biz-1/agreements'), () => ok([opts.agreement ?? makeAgreement()]))
  );
}

/** Captures bodies PATCHed to `path`. */
function capturePatch(path: string) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(apiUrl(path), async ({ request }) => {
      bodies.push(await request.json());
      return ok(makeAgreement());
    })
  );
  return bodies;
}

function Where() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div>challan page</div>
      <div data-testid="where">{pathname}</div>
      <div data-testid="state">{JSON.stringify(state)}</div>
    </>
  );
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/agreements/:agreementId" element={<AgreementDetailPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn(), route: '/agreements/AG-001' }
  );
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: RegExp) {
  await user.click(await screen.findByRole('tab', { name }));
}

describe('AgreementDetailPage', () => {
  it('shows the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Agreement not found' } },
          { status: 404 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText(/Agreement not found/)).toBeInTheDocument();
  });

  it('renders the header, tabs with counts, period, terms and the details sidebar', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'AG-001', level: 1 })).toBeVisible();
    expect(screen.queryByText(/Agreement ·/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Active')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Back to Agreements' })).toHaveAttribute(
      'href',
      '/agreements'
    );
    await waitFor(() =>
      expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
        'About',
        'Site items 1',
        'Challans 2',
        'Change history',
      ])
    );

    const period = screen.getByRole('heading', { name: 'Period' }).closest('section')!;
    expect(within(period).getByRole('button', { name: /1 Apr 2025/ })).toBeVisible();
    expect(within(period).getByRole('button', { name: /Not added/ })).toBeVisible();

    const terms = screen.getByRole('heading', { name: 'Terms' }).closest('section')!;
    expect(within(terms).getByText('Billing cycle')).toBeInTheDocument();
    expect(within(terms).getByRole('button', { name: /Monthly/ })).toBeVisible();
    const due = within(terms).getByRole('button', { name: /30 days/ });
    expect(within(due).getByText('30')).toHaveClass('mono');
    expect(within(terms).getByRole('button', { name: /₹50,000/ })).toHaveClass('mono');
    expect(within(terms).getByRole('button', { name: /₹1,500/ })).toHaveClass('mono');
    expect(within(terms).getAllByRole('button', { name: /Not added/ })).toHaveLength(3);

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).getByText('AG-001')).toHaveClass('mono');
    expect(within(details).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(within(details).getByText('S1')).toHaveClass('mono');
    expect(within(details).getByText('20 Mar 2025')).toBeInTheDocument();
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
  });

  it('shows no tab counts while the lists are loading', async () => {
    useApi();
    server.use(
      http.get(apiUrl('/businesses/biz-1/challans'), async () => {
        await new Promise(r => setTimeout(r, 300));
        return paged(challans);
      })
    );
    renderPage();
    expect(await screen.findByRole('tab', { name: 'Challans' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Challans 2' })).toBeInTheDocument();
  });

  it('lists rates with mono right-aligned values', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table', { name: 'Items and rates' });
    const row = await within(table).findByRole('row', { name: /Ladder 1.5m/ });
    expect(within(row).getByText('LAD')).toHaveClass('mono');
    expect(within(row).getByText('Ladders')).toBeInTheDocument();
    const rate = within(row).getByRole('button', { name: /₹5/ });
    expect(rate.closest('td')).toHaveClass('mono', 'right');
    expect(rate).toHaveClass('right');
    expect(
      within(within(table).getByRole('row', { name: /Prop 3m/ })).getByRole('button', {
        name: /₹1,250.50/,
      })
    ).toBeVisible();
  });

  it('saves an edited rate with the exact payload and cancels with Escape', async () => {
    useApi();
    const bodies = capturePatch(`${BASE}/rates/i1`);
    const { user } = renderPage();
    const table = await screen.findByRole('table', { name: 'Items and rates' });
    const row = await within(table).findByRole('row', { name: /Ladder 1.5m/ });

    await user.click(within(row).getByRole('button', { name: /₹5/ }));
    await user.type(within(row).getByRole('spinbutton', { name: 'Rate per day' }), '9{Escape}');
    expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.click(within(row).getByRole('button', { name: /₹5/ }));
    const input = within(row).getByRole('spinbutton', { name: 'Rate per day' });
    await user.clear(input);
    await user.type(input, '7.5{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ ratePerDay: 7.5 }]));
  });

  it('saves an edited opening balance', async () => {
    useApi();
    const bodies = capturePatch(`${BASE}/rates/i1`);
    const { user } = renderPage();
    const table = await screen.findByRole('table', { name: 'Items and rates' });
    const row = await within(table).findByRole('row', { name: /Ladder 1.5m/ });
    await user.click(within(row).getByRole('button', { name: /10/ }));
    const input = within(row).getByRole('spinbutton', { name: 'Opening stock' });
    await user.clear(input);
    await user.type(input, '12{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ openingBalance: 12 }]));
  });

  it('falls back to the agreement rates when the item details have not loaded', async () => {
    useApi({ rates: [] });
    const bodies = capturePatch(`${BASE}/rates/i1`);
    const { user } = renderPage();
    const table = await screen.findByRole('table', { name: 'Items and rates' });
    const row = within(table).getByRole('row', { name: /i1/ });
    await user.click(within(row).getByRole('button', { name: /₹5/ }));
    const input = within(row).getByRole('spinbutton', { name: 'Rate per day' });
    await user.clear(input);
    await user.type(input, '6{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ ratePerDay: 6 }]));
  });

  it('shows an empty state without rates', async () => {
    useApi({ rates: [], agreement: makeAgreement({ rates: [] }) });
    renderPage();
    expect(await screen.findByText('No items or rates yet')).toBeInTheDocument();
  });

  it('saves the status, a date and terms with the same payloads', async () => {
    useApi();
    const bodies = capturePatch(BASE);
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Active' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Terminated' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Expired' }));
    await waitFor(() => expect(bodies).toHaveLength(1));

    const terms = screen.getByRole('heading', { name: 'Terms' }).closest('section')!;
    await user.click(within(terms).getByRole('button', { name: /30 days/ }));
    const due = within(terms).getByRole('spinbutton');
    await user.clear(due);
    await user.type(due, '45{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(2));

    await user.click(within(terms).getByRole('button', { name: /₹50,000/ }));
    const dep = within(terms).getByRole('spinbutton');
    await user.clear(dep);
    await user.type(dep, '60000{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(3));

    const period = screen.getByRole('heading', { name: 'Period' }).closest('section')!;
    await user.click(within(period).getByRole('button', { name: /1 Apr 2025/ }));
    const start = period.querySelector('input[type="date"]') as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '2025-05-01{Enter}');
    await waitFor(() => expect(bodies).toHaveLength(4));

    expect(bodies).toEqual([
      { status: 'expired' },
      { terms: { paymentDueDays: 45 } },
      { terms: { securityDeposit: 60000 } },
      { startDate: '2025-05-01' },
    ]);
  });

  it('lists items at the site', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Site items/);
    const table = screen.getByRole('table', { name: 'Items at site' });
    const row = within(table).getByRole('row', { name: /Ladder 1.5m/ });
    expect(within(row).getByText('24').closest('td')).toHaveClass('mono', 'right');
  });

  it('flags a negative count at the site', async () => {
    useApi();
    server.use(
      http.get(apiUrl('/businesses/biz-1/challans/items-with-party/p1'), () =>
        ok([{ itemId: 'i9', itemName: 'Inner 2 mtr', quantity: -18 }])
      )
    );
    const { user } = renderPage();
    await openTab(user, /^Site items/);
    const table = await screen.findByRole('table', { name: 'Items at site' });
    expect(within(table).getByText('-18').closest('td')).toHaveClass('tone-negative');
    expect(screen.getByText('Some counts are below zero')).toBeInTheDocument();
  });

  it('lists challans and opens one on row click', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Challans/);
    const table = screen.getByRole('table', { name: 'Challans' });
    const row = within(table).getByRole('row', { name: /D-2026-27-0001/ });
    expect(within(row).getByText('Delivery')).toBeInTheDocument();
    expect(within(row).getByText('10 Nov 2025')).toBeInTheDocument();
    expect(within(row).getByText('2').closest('td')).toHaveClass('mono', 'right');
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'D-2026-27-0001' })).toHaveAttribute(
      'href',
      '/challans/c1'
    );
    await user.click(within(row).getByText('10 Nov 2025'));
    expect(await screen.findByText('challan page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/challans/c1');
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '').recordNav).toEqual({
      paths: ['/challans/c1', '/challans/c2'],
      index: 0,
    });
  });

  it('shows empty states for site items and challans', async () => {
    useApi();
    server.use(
      http.get(apiUrl('/businesses/biz-1/challans/items-with-party/p1'), () => ok([])),
      http.get(apiUrl('/businesses/biz-1/challans'), () => paged([]))
    );
    const { user } = renderPage();
    await openTab(user, /^Site items/);
    expect(await screen.findByText('No items at this site')).toBeInTheDocument();
    await openTab(user, /^Challans/);
    expect(await screen.findByText('No challans yet')).toBeInTheDocument();
  });

  it('loads the change history', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/agreement/AG-001'), ({ request }) => {
        historyUrl = request.url;
        return paged([]);
      })
    );
    const { user } = renderPage();
    await openTab(user, /Change history/);
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/agreement/AG-001'));
  });
});

describe('AgreementDetailPage change rates', () => {
  it('changes rates from an active agreement and opens the new agreement', async () => {
    useApi();
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl(`${BASE}/change-rates`), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          {
            success: true,
            data: {
              previous: makeAgreement({ status: 'expired', nextAgreementId: 'AG-002' }),
              agreement: makeAgreement({ agreementId: 'AG-002', previousAgreementId: 'AG-001' }),
            },
          },
          { status: 201 }
        );
      }),
      http.get(apiUrl('/businesses/biz-1/agreements/AG-002'), () =>
        ok(makeAgreement({ agreementId: 'AG-002', previousAgreementId: 'AG-001' }))
      ),
      http.get(apiUrl('/businesses/biz-1/agreements/AG-002/rates'), () => ok(rates))
    );
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Change rates' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/New rates from/), {
      target: { value: '2026-09-01' },
    });
    await user.clear(within(dialog).getByLabelText('New rate for Ladder 1.5m'));
    await user.type(within(dialog).getByLabelText('New rate for Ladder 1.5m'), '6');
    await user.click(within(dialog).getByRole('button', { name: 'Change rates' }));

    // the new agreement's page links back to the one it replaced
    expect(await screen.findByRole('link', { name: 'AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodies).toEqual([
      { effectiveDate: '2026-09-01', rates: [{ itemId: 'i1', ratePerDay: 6 }] },
    ]);
  });

  it("shows the server's reason when the change is refused", async () => {
    useApi();
    server.use(
      http.post(apiUrl(`${BASE}/change-rates`), () =>
        HttpResponse.json(
          {
            success: false,
            error: { message: 'Delete bill(s) B-9 first: they cover 2026-09-01 or later' },
          },
          { status: 409 }
        )
      )
    );
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Change rates' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/New rates from/), {
      target: { value: '2026-09-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Change rates' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('B-9');
  });

  it('links an expired agreement to the one that replaced it, without a change rates button', async () => {
    useApi({
      agreement: makeAgreement({
        status: 'expired',
        endDate: '2026-08-31T00:00:00.000Z',
        nextAgreementId: 'AG-002',
      }),
    });
    renderPage();

    expect(await screen.findByRole('link', { name: 'AG-002' })).toHaveAttribute(
      'href',
      '/agreements/AG-002'
    );
    expect(screen.queryByRole('button', { name: 'Change rates' })).not.toBeInTheDocument();
  });

  it('links a successor to the agreement it replaced', async () => {
    useApi({ agreement: makeAgreement({ previousAgreementId: 'AG-000' }) });
    renderPage();

    expect(await screen.findByRole('link', { name: 'AG-000' })).toHaveAttribute(
      'href',
      '/agreements/AG-000'
    );
  });
});

describe('AgreementDetailPage challans by site', () => {
  it("shows the site's challans from the agreement's start, including ones still on the old agreement", async () => {
    const next = makeAgreement({
      agreementId: 'AG-002',
      startDate: '2026-09-01T00:00:00.000Z',
      previousAgreementId: 'AG-001',
    });
    const old = makeAgreement({
      status: 'expired',
      endDate: '2026-08-31T00:00:00.000Z',
      nextAgreementId: 'AG-002',
    });
    const siteChallans = [
      {
        _id: 'a',
        agreementId: 'AG-001',
        challanNumber: 'D-2026-27-0010',
        type: 'delivery',
        date: '2026-08-20T00:00:00.000Z',
        items: [{}],
        status: 'confirmed',
      },
      {
        _id: 'b',
        agreementId: 'AG-001',
        challanNumber: 'D-2026-27-0011',
        type: 'delivery',
        date: '2026-09-03T00:00:00.000Z',
        items: [{}],
        status: 'confirmed',
      },
      {
        _id: 'c',
        agreementId: 'AG-002',
        challanNumber: 'R-2026-27-0012',
        type: 'return',
        date: '2026-09-10T00:00:00.000Z',
        items: [{}],
        status: 'confirmed',
      },
      {
        _id: 'd',
        agreementId: 'AG-OTHER',
        challanNumber: 'D-2026-27-0013',
        type: 'delivery',
        date: '2026-09-05T00:00:00.000Z',
        items: [{}],
        status: 'confirmed',
      },
    ] as unknown as Challan[];
    useApi({ agreement: next });
    server.use(
      http.get(apiUrl('/businesses/biz-1/agreements/AG-002'), () => ok(next)),
      http.get(apiUrl('/businesses/biz-1/agreements/AG-002/rates'), () => ok(rates)),
      http.get(apiUrl('/businesses/biz-1/challans/items-with-party/p1'), () => ok(itemsAtSite)),
      http.get(apiUrl('/businesses/biz-1/challans'), () => paged(siteChallans)),
      http.get(apiUrl('/businesses/biz-1/agreements'), () =>
        ok([old, next, makeAgreement({ agreementId: 'AG-OTHER', siteCode: 'S2' })])
      )
    );
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/agreements/:agreementId" element={<AgreementDetailPage />} />
      </Routes>,
      { preloadedState: signedIn(), route: '/agreements/AG-002' }
    );

    await user.click(await screen.findByRole('tab', { name: /Challans 2/ }));

    const table = screen.getByRole('table', { name: 'Challans' });
    expect(within(table).getByText('D-2026-27-0011')).toBeInTheDocument();
    expect(within(table).getByText('R-2026-27-0012')).toBeInTheDocument();
    expect(within(table).queryByText('D-2026-27-0010')).not.toBeInTheDocument();
    expect(within(table).queryByText('D-2026-27-0013')).not.toBeInTheDocument();
  });
});
