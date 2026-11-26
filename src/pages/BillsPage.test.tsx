import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BillsPage } from './BillsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import type { Bill, Party } from '../types';
import * as bulk from '../utils/runBulk';

// Passthrough spy: lets a test count how many bulk runs start.
vi.mock('../utils/runBulk', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils/runBulk')>();
  return { ...actual, runBulk: vi.fn(actual.runBulk) };
});

const bill = (over: Partial<Bill>) =>
  ({
    _id: 'b1',
    billNumber: 'B-2026-27-0001',
    partyId: 'p1',
    agreementId: 'a1',
    billDate: '2026-11-16T00:00:00.000Z',
    billingPeriod: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T00:00:00.000Z' },
    totalAmount: 184200,
    amountPaid: 50000,
    status: 'draft',
    ...over,
  }) as unknown as Bill;

const DRIFT = { delta: {} as never, detectedAt: '2026-01-01', causes: [] };

const defaults = [
  bill({}),
  bill({
    _id: 'b2',
    billNumber: 'B-2026-27-0002',
    partyId: 'p2',
    totalAmount: 99.5,
    amountPaid: 0,
    status: 'sent',
    pendingAdjustment: { amount: 40, delta: {} as never, detectedAt: '2026-01-01', causes: [] },
  }),
  bill({ _id: 'b3', billNumber: 'B-2026-27-0003', status: 'paid' }),
  bill({ _id: 'b4', billNumber: 'B-2026-27-0004', status: 'cancelled' }),
];

const PARTY_NAMES: Record<string, string> = { p1: 'Mehta Builders', p2: 'Om Constructions' };

/** The backend's bill list filters: status, and search on number or party name. */
function matchBill(b: Bill, q: URLSearchParams): boolean {
  const search = q.get('search')?.toLowerCase();
  return (
    (!q.get('status') || b.status === q.get('status')) &&
    (!search ||
      b.billNumber.toLowerCase().includes(search) ||
      (PARTY_NAMES[b.partyId] ?? '').toLowerCase().includes(search))
  );
}

function useApi(bills: Bill[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () =>
      ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.', settings: { defaultTaxRate: 18 } }])
    ),
    // Behaves like the backend: status filter and search applied server-side.
    http.get(apiUrl('/businesses/biz-1/bills'), ({ request }) =>
      pagedOk(bills, request, matchBill)
    ),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([
        { _id: 'p1', name: 'Mehta Builders', isActive: true, agreements: [], sites: [] },
        { _id: 'p2', name: 'Om Constructions', isActive: true, agreements: [], sites: [] },
      ] as unknown as Party[])
    ),
    http.get(apiUrl('/businesses/biz-1/agreements'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/bills/next-number'), () => ok('B-2026-27-0005'))
  );
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
      <Route path="/" element={<BillsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn() }
  );
}

const rowNumbers = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[1].textContent);

afterEach(() => vi.restoreAllMocks());

describe('BillsPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading bills…')).toBeInTheDocument();
  });

  it('lists bills with formatted amounts, party and status', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(rowNumbers()).toEqual([
      'B-2026-27-0001',
      'B-2026-27-0002',
      'B-2026-27-0003',
      'B-2026-27-0004',
    ]);
    const row = within(table).getByRole('row', { name: /B-2026-27-0001/ });
    expect(within(row).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(row).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(row).getByText('₹50,000')).toBeInTheDocument();
    expect(within(row).getByText('Draft')).toBeInTheDocument();
    const issued = within(table).getByRole('row', { name: /B-2026-27-0002/ });
    expect(within(issued).getByText('₹99.50')).toBeInTheDocument();
    expect(within(issued).getByText('Pending adj.')).toBeInTheDocument();
    expect(within(issued).queryByText('Out of date')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByText('Out of date')).not.toBeInTheDocument();
  });

  it('shows the effective amount, with the original under it when notes exist', async () => {
    useApi([
      bill({ status: 'sent', notesTotal: -4200 }),
      bill({ _id: 'b2', billNumber: 'B-2026-27-0002', status: 'sent', notesTotal: 0 }),
    ]);
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByRole('row', { name: /B-2026-27-0001/ });
    expect(within(row).getByText('₹1,80,000')).toHaveClass('mono');
    expect(within(row).getByText('₹1,84,200')).toHaveClass('mono');
    expect(within(row).getByText(/^was/)).toBeInTheDocument();
    const plain = within(table).getByRole('row', { name: /B-2026-27-0002/ });
    expect(within(plain).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(plain).queryByText(/^was/)).not.toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Bills' });
    const item = within(list).getByText('B-2026-27-0001').closest('li') as HTMLElement;
    expect(within(item).getByText('₹1,80,000')).toHaveClass('mono');
    expect(within(item).getByText(/^was/)).toBeInTheDocument();
  });

  it('flags a draft that is out of date', async () => {
    useApi([
      bill({ drift: DRIFT }),
      bill({ _id: 'b6', billNumber: 'B-6', status: 'paid', drift: DRIFT }),
    ]);
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByRole('row', { name: /B-2026-27-0001/ });
    expect(within(row).getByText('Out of date')).toBeInTheDocument();
    expect(within(row).queryByText('Pending adj.')).not.toBeInTheDocument();
    const issued = within(table).getByRole('row', { name: /B-6/ });
    expect(within(issued).queryByText('Out of date')).not.toBeInTheDocument();
  });

  it('offers Send on drafts and Mark paid on sent bills only, rest in the menu', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('button', { name: 'Send' })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: 'Mark paid' })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: 'More actions' })).toHaveLength(4);
  });

  it('filters by status', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'paid');
    await waitFor(() => expect(rowNumbers()).toEqual(['B-2026-27-0003']));
  });

  it('searches by party name and by bill number', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search bills' });
    await user.type(search, 'om cons');
    await waitFor(() => expect(rowNumbers()).toEqual(['B-2026-27-0002']));
    await user.clear(search);
    await user.type(search, '0004');
    await waitFor(() => expect(rowNumbers()).toEqual(['B-2026-27-0004']));
  });

  it('focuses the search box on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search bills' })).toHaveFocus();
  });

  it('shows filtered-empty and empty states', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search bills' }), 'zzz');
    expect(await screen.findByText('No bills match these filters')).toBeInTheDocument();
  });

  it('shows an empty state with no bills', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findByText('No bills yet')).toBeInTheDocument();
  });

  it('sends a draft bill by email without navigating', async () => {
    useApi();
    let sent = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/b1/send'), () => {
        sent = true;
        return ok(bill({}));
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sent).toBe(true));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('shows the error in a dialog when sending fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/b1/send'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog', { name: 'Something went wrong' });
    expect(dialog).toHaveTextContent('Nope');
    expect(alertSpy).not.toHaveBeenCalled();
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks a sent bill paid', async () => {
    useApi();
    let body: unknown;
    server.use(
      http.patch(apiUrl('/businesses/biz-1/bills/b2/status'), async ({ request }) => {
        body = await request.json();
        return ok(bill({ status: 'paid' }));
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(body).toEqual({ status: 'paid' }));
  });

  it('deletes drafts and cancelled bills after confirming; issued bills have no delete', async () => {
    useApi();
    const urls: string[] = [];
    server.use(
      http.delete(apiUrl('/businesses/biz-1/bills/:id'), ({ request }) => {
        urls.push(new URL(request.url).pathname);
        return ok({});
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menus = within(table).getAllByRole('button', { name: 'More actions' });
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete B-2026-27-0001?' });
    expect(dialog).toHaveTextContent("This can't be undone.");
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(urls).toHaveLength(1));
    await user.click(menus[1]);
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(menus[3]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[0]).toMatch(/\/b1$/);
  });

  it('blocks sending an out of date draft and offers a refresh', async () => {
    useApi([bill({ drift: DRIFT })]);
    let sent = false;
    let refreshed = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/b1/send'), () => {
        sent = true;
        return ok(bill({}));
      }),
      http.post(apiUrl('/businesses/biz-1/bills/b1/refresh'), () => {
        refreshed = true;
        return ok(bill({}));
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Refresh bill' }));
    await waitFor(() => expect(refreshed).toBe(true));
    expect(sent).toBe(false);
  });

  it('asks before sending a draft the server says has negative stock', async () => {
    useApi([bill({})]);
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/b1/send'), async ({ request }) => {
        const body = await request.json().catch(() => null);
        bodies.push(body);
        if (body) return ok(bill({}));
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'NEGATIVE_STOCK_ACK_REQUIRED',
              details: {
                negativeStock: [
                  {
                    itemId: 'i1',
                    itemName: 'Prop 3m',
                    from: '2026-10-03T00:00:00.000Z',
                    to: '2026-10-03T00:00:00.000Z',
                    minQty: -1,
                  },
                ],
              },
            },
          },
          { status: 409 }
        );
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Prop 3m: 3 Oct, lowest count -1/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(bodies).toEqual([null, { acknowledgeNegative: true }]));
  });

  it('does not delete when declined', async () => {
    useApi();
    let called = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/bills/:id'), () => {
        called = true;
        return ok({});
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('downloads the invoice PDF', async () => {
    useApi();
    server.use(
      http.get(
        apiUrl('/businesses/biz-1/bills/b1/pdf'),
        () => new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } })
      )
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Download invoice PDF' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
  });

  it('navigates to the bill when a row is clicked', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Om Constructions'));
    expect(screen.getByTestId('where')).toHaveTextContent('/bills/b2');
  });

  it('carries the filtered list as navigation context when a row is opened', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'paid');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    await user.click(within(screen.getByRole('table')).getByText('B-2026-27-0003'));
    expect(screen.getByTestId('where')).toHaveTextContent('/bills/b3');
    const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
    expect(recordNav.paths).toEqual(['/bills/b3']);
    expect(recordNav.server.page).toBe(1);
    expect(recordNav.server.source.list).toBe('bills');
    expect(recordNav.server.source.args.status).toBe('paid');
  });

  it('opens the generate and bulk generate modals', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Generate bill/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Generate bill/);
    await user.click(screen.getByRole('button', { name: /^Cancel/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Bulk generate/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Bulk generate bills/);
  });

  it('opens the generate modal with Alt+N', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'KeyN', altKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows the party, date and amount in the phone list', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Bills' });
    const item = within(list).getByText('B-2026-27-0001').closest('li') as HTMLElement;
    expect(within(item).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(item).getByText(/₹1,84,200/)).toBeInTheDocument();
    expect(within(item).getByText('₹50,000')).toHaveClass('mono');
    expect(within(item).getByText(/^Paid/)).toBeInTheDocument();
  });

  it('runs a phone-list action without navigating', async () => {
    useApi();
    let sent = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/b1/send'), () => {
        sent = true;
        return ok(bill({}));
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Bills' });
    const item = within(list).getByText('B-2026-27-0001').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sent).toBe(true));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('keeps every action reachable in the phone list', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Bills' });
    const item = within(list).getByText('B-2026-27-0004').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Download invoice PDF' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('pages through bills, asking the server for each page', async () => {
    const seen: string[] = [];
    const many = Array.from({ length: 27 }, (_, i) =>
      bill({
        _id: `b${i}`,
        billNumber: `B-2026-27-${String(i + 1).padStart(4, '0')}`,
        status: 'sent',
      })
    );
    useApi(many);
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/biz-1/bills')) seen.push(url.search);
    });
    const { user } = renderPage();
    await screen.findByRole('table');
    const nav = screen.getByRole('navigation', { name: 'Bills pages' });
    expect(nav).toHaveTextContent('Showing 1–25 of 27');

    await user.click(within(nav).getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(rowNumbers()).toEqual(['B-2026-27-0026', 'B-2026-27-0027']));
    expect(seen).toContain('?page=2&pageSize=25');
    server.events.removeAllListeners();
  });

  it('shows an error with retry when loading fails', async () => {
    server.use(
      http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
      http.get(apiUrl('/businesses/biz-1/bills'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      ),
      http.get(apiUrl('/businesses/biz-1/parties'), () => ok([])),
      http.get(apiUrl('/businesses/biz-1/agreements'), () => ok([]))
    );
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a business when none is selected', () => {
    server.use(http.get(apiUrl('/businesses'), () => ok([])));
    renderWithProviders(<BillsPage />, { preloadedState: signedIn('') });
    expect(screen.getByText('Please select a business')).toBeInTheDocument();
  });
});

const conflict = (code: string, details?: Record<string, unknown>) =>
  HttpResponse.json(
    { success: false, error: { code, message: `${code} message`, details } },
    { status: 409 }
  );

const SPAN = {
  itemId: 'i1',
  itemName: 'Prop 3m',
  from: '2026-10-03T00:00:00.000Z',
  to: '2026-10-03T00:00:00.000Z',
  minQty: -1,
};

const drafts3 = [
  bill({ _id: 'd1', billNumber: 'B-1' }),
  bill({ _id: 'd2', billNumber: 'B-2' }),
  bill({ _id: 'd3', billNumber: 'B-3' }),
];

const mixed = [
  bill({ _id: 'd1', billNumber: 'B-1' }),
  bill({ _id: 'd2', billNumber: 'B-2' }),
  bill({ _id: 'p1', billNumber: 'B-3', status: 'paid' }),
  bill({ _id: 'c1', billNumber: 'B-4', status: 'cancelled' }),
];

const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });

/** Ticks the table checkbox of each bill number. */
async function pick(user: ReturnType<typeof renderPage>['user'], ...numbers: string[]) {
  const table = screen.getByRole('table');
  for (const n of numbers)
    await user.click(within(table).getByRole('checkbox', { name: `Select ${n}` }));
}

const doneDialog = () => screen.findByRole('dialog', { name: 'Done' });

/** Records each PATCH status body by bill id; `reply` can override the response. */
function trackStatus(reply?: (id: string, body: Record<string, unknown>) => Response | undefined) {
  const calls: Array<{ id: string; body: Record<string, unknown> }> = [];
  server.use(
    http.patch(apiUrl('/businesses/biz-1/bills/:id/status'), async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ id, body });
      return reply?.(id, body) ?? ok(bill({ _id: id, status: body.status as Bill['status'] }));
    })
  );
  return calls;
}

describe('BillsPage row menu', () => {
  const menuItems = async (user: ReturnType<typeof renderPage>['user'], index: number) => {
    const table = screen.getByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[index]);
    const names = screen.getAllByRole('menuitem').map(i => i.textContent);
    await user.keyboard('{Escape}');
    return names;
  };

  it('shows only the moves each status allows', async () => {
    useApi([
      ...defaults,
      bill({ _id: 'b5', billNumber: 'B-5', status: 'partial' }),
      bill({ _id: 'b6', billNumber: 'B-6', status: 'overdue' }),
    ]);
    const { user } = renderPage();
    await screen.findByRole('table');
    expect(await menuItems(user, 0)).toEqual([
      'Mark as sentLocks the bill. No email is sent.',
      'Download invoice PDF',
      'Cancel bill',
      'Delete',
    ]);
    for (const i of [1, 2, 4, 5])
      expect(await menuItems(user, i)).toEqual(['Download invoice PDF']);
    expect(await menuItems(user, 3)).toEqual(['Download invoice PDF', 'Delete']);
  });

  it('marks a draft as sent after confirming, without email', async () => {
    useApi();
    const calls = trackStatus();
    let emailed = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/:id/send'), () => {
        emailed = true;
        return ok(null);
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    expect(screen.getByRole('menuitem', { name: 'Mark as sent' })).toHaveAccessibleDescription(
      'Locks the bill. No email is sent.'
    );
    await user.click(screen.getByRole('menuitem', { name: 'Mark as sent' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark B-2026-27-0001 as sent?' });
    expect(dialog).toHaveTextContent(
      'The bill will be locked. Any later change is made with a correction, not by editing the bill.'
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Mark as sent' }));
    await waitFor(() => expect(calls).toEqual([{ id: 'b1', body: { status: 'sent' } }]));
    expect(emailed).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('words the negative stock question for marking as sent', async () => {
    useApi();
    const calls = trackStatus((_id, body) =>
      body.acknowledgeNegative
        ? undefined
        : conflict('NEGATIVE_STOCK_ACK_REQUIRED', { negativeStock: [SPAN] })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Mark as sent' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as sent' })
    );
    const ask = await screen.findByRole('dialog', { name: 'Stock went below zero' });
    expect(ask).toHaveTextContent('Mark the bill as sent anyway?');
    expect(within(ask).queryByRole('button', { name: 'Send anyway' })).not.toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Mark as sent anyway' }));
    await waitFor(() =>
      expect(calls.map(c => c.body)).toEqual([
        { status: 'sent' },
        { status: 'sent', acknowledgeNegative: true },
      ])
    );
  });

  it('blocks marking an out of date draft as sent', async () => {
    useApi([bill({ drift: DRIFT })]);
    const calls = trackStatus();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mark as sent' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as sent' })
    );
    expect(await screen.findByRole('dialog', { name: 'Bill is out of date' })).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('cancels a draft after confirming, and keeps it when declined', async () => {
    useApi();
    const calls = trackStatus();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menu = within(table).getAllByRole('button', { name: 'More actions' })[0];
    await user.click(menu);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel bill' }));
    let dialog = screen.getByRole('dialog', { name: 'Cancel B-2026-27-0001?' });
    expect(dialog).toHaveTextContent('You can delete it afterwards.');
    await user.click(within(dialog).getByRole('button', { name: 'Keep bill' }));
    expect(calls).toEqual([]);
    await user.click(menu);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel bill' }));
    dialog = screen.getByRole('dialog', { name: 'Cancel B-2026-27-0001?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel bill' }));
    await waitFor(() => expect(calls).toEqual([{ id: 'b1', body: { status: 'cancelled' } }]));
  });

  it('shows a failed status change in a dialog', async () => {
    useApi();
    trackStatus(() => HttpResponse.json({ success: false, message: 'No way' }, { status: 400 }));
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Mark paid' }));
    expect(await screen.findByRole('dialog', { name: 'Something went wrong' })).toHaveTextContent(
      'No way'
    );
  });
});

describe('BillsPage bulk actions', () => {
  it('counts what each action applies to on a mixed selection', async () => {
    useApi(mixed);
    const { user } = renderPage();
    await screen.findByRole('table');
    expect(bar()).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    const region = bar()!;
    expect(region).toHaveTextContent('4 bills selected');
    expect(within(region).getByRole('button', { name: 'Mark 2 as sent' })).toBeEnabled();
    expect(within(region).getByRole('button', { name: 'Send 2 to clients' })).toBeEnabled();
    expect(within(region).getByRole('button', { name: 'Download 4 PDFs' })).toBeEnabled();
    expect(within(region).getByRole('button', { name: 'Delete 3' })).toBeEnabled();
  });

  it('disables actions that apply to none of the selection', async () => {
    useApi(mixed);
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-3');
    const region = bar()!;
    expect(region).toHaveTextContent('1 bill selected');
    expect(within(region).getByRole('button', { name: 'Mark 0 as sent' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: 'Send 0 to clients' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: 'Delete 0' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: 'Download 1 PDF' })).toBeEnabled();
    await user.click(within(region).getByRole('button', { name: 'Clear' }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('marks the drafts as sent and lists the others as skipped', async () => {
    useApi(mixed);
    const calls = trackStatus();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Mark 2 as sent' }));
    const confirmDialog = screen.getByRole('dialog', { name: 'Mark 2 bills as sent?' });
    expect(confirmDialog).toHaveTextContent('They will be locked. No emails are sent.');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Mark as sent' }));
    const done = await doneDialog();
    expect(calls.map(c => c.id).sort()).toEqual(['d1', 'd2']);
    expect(calls.every(c => c.body.status === 'sent' && !('acknowledgeNegative' in c.body))).toBe(
      true
    );
    expect(done).toHaveTextContent('2 marked as sent');
    expect(done).toHaveTextContent('Skipped (2)');
    const skipped = within(done)
      .getAllByRole('listitem')
      .map(li => li.textContent);
    expect(skipped).toEqual(['B-3: already sent', 'B-4: cancelled']);
    // The skipped bills stay selected.
    expect(bar()).toHaveTextContent('2 bills selected');
    await user.click(within(done).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses singular copy for one bill', async () => {
    useApi(mixed);
    trackStatus();
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1');
    await user.click(within(bar()!).getByRole('button', { name: 'Send 1 to client' }));
    expect(screen.getByRole('dialog', { name: 'Email 1 bill to its client?' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Mark 1 as sent' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark 1 bill as sent?' });
    expect(dialog).toHaveTextContent('It will be locked. No email is sent.');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as sent' }));
    expect(await doneDialog()).toHaveTextContent('1 marked as sent');
    expect(bar()).not.toBeInTheDocument();
  });

  it('skips an out of date draft and keeps it selected', async () => {
    useApi(drafts3);
    const calls = trackStatus(id => (id === 'd2' ? conflict('BILL_OUT_OF_DATE') : undefined));
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Mark 3 as sent' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as sent' })
    );
    const done = await doneDialog();
    expect(calls).toHaveLength(3);
    expect(done).toHaveTextContent('2 marked as sent');
    expect(
      within(done)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['B-2: out of date, open it and press Refresh']);
    expect(bar()).toHaveTextContent('1 bill selected');
    const table = screen.getByRole('table');
    expect(within(table).getByRole('checkbox', { name: 'Select B-2' })).toBeChecked();
    expect(within(table).getByRole('checkbox', { name: 'Select B-1' })).not.toBeChecked();
  });

  it('never sends a draft the list already shows as out of date', async () => {
    useApi([bill({ _id: 'd1', billNumber: 'B-1', drift: DRIFT }), drafts3[1]]);
    const sent: string[] = [];
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/:id/send'), ({ params }) => {
        sent.push(String(params.id));
        return ok(null);
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Send 2 to clients' }));
    const confirmDialog = screen.getByRole('dialog', { name: 'Email 2 bills to their clients?' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'Send' }));
    const done = await doneDialog();
    expect(sent).toEqual(['d2']);
    expect(done).toHaveTextContent('1 sent');
    expect(done).toHaveTextContent('B-1: out of date, open it and press Refresh');
  });

  it('asks once about negative stock; Cancel leaves that bill unsent', async () => {
    useApi(drafts3);
    const calls = trackStatus((id, body) =>
      id === 'd3' && !body.acknowledgeNegative
        ? conflict('NEGATIVE_STOCK_ACK_REQUIRED', { negativeStock: [SPAN] })
        : undefined
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Mark 3 as sent' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as sent' })
    );
    const ask = await screen.findByRole('dialog', { name: '1 bill shows stock below zero' });
    expect(ask).toHaveTextContent('B-3');
    expect(within(ask).getByText(/Prop 3m: 3 Oct, lowest count -1/)).toBeInTheDocument();
    expect(within(ask).getByRole('button', { name: 'Mark as sent anyway' })).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    const done = await doneDialog();
    expect(calls).toHaveLength(3);
    expect(done).toHaveTextContent('2 marked as sent');
    expect(
      within(done)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['B-3: stock below zero, not marked as sent']);
    expect(bar()).toHaveTextContent('1 bill selected');
  });

  it('Send anyway retries only the negative stock bills with the acknowledgement', async () => {
    useApi(drafts3);
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/:id/send'), async ({ params, request }) => {
        const body = await request.json().catch(() => null);
        bodies.push({ id: params.id, body });
        if (params.id !== 'd1' && !body) return conflict('NEGATIVE_STOCK_ACK_REQUIRED', {});
        return ok(null);
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Send 3 to clients' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send' }));
    const ask = await screen.findByRole('dialog', { name: '2 bills show stock below zero' });
    // No spans in the error: bill numbers only.
    expect(ask).toHaveTextContent('B-2');
    expect(ask).toHaveTextContent('B-3');
    expect(within(ask).queryByRole('list')).not.toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Send anyway' }));
    const done = await doneDialog();
    expect(done).toHaveTextContent('3 sent');
    expect(done).not.toHaveTextContent('Skipped');
    expect(bodies.slice(3)).toEqual(
      expect.arrayContaining([
        { id: 'd2', body: { acknowledgeNegative: true } },
        { id: 'd3', body: { acknowledgeNegative: true } },
      ])
    );
    expect(bodies).toHaveLength(5);
    expect(bar()).not.toBeInTheDocument();
  });

  it('keeps the send wording when emailing; Cancel says not sent', async () => {
    useApi(drafts3.slice(0, 1));
    server.use(
      http.post(apiUrl('/businesses/biz-1/bills/:id/send'), () =>
        conflict('NEGATIVE_STOCK_ACK_REQUIRED')
      )
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1');
    await user.click(within(bar()!).getByRole('button', { name: 'Send 1 to client' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send' }));
    const ask = await screen.findByRole('dialog', { name: '1 bill shows stock below zero' });
    expect(within(ask).getByRole('button', { name: 'Send anyway' })).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(await doneDialog()).toHaveTextContent('B-1: stock below zero, not sent');
  });

  it('starts one run of downloads on a fast double click', async () => {
    useApi(mixed);
    const fetched: string[] = [];
    server.use(
      http.get(apiUrl('/businesses/biz-1/bills/:id/pdf'), ({ params }) => {
        fetched.push(String(params.id));
        return new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1', 'B-2');
    const button = within(bar()!).getByRole('button', { name: 'Download 2 PDFs' });
    // React disables the button after the first click; call its handler twice directly so
    // the second call hits the in-flight guard (a click landing before that re-render).
    vi.mocked(bulk.runBulk).mockClear();
    const propsKey = Object.keys(button).find(k => k.startsWith('__reactProps'))!;
    const { onClick } = (button as unknown as Record<string, { onClick: () => void }>)[propsKey];
    await act(async () => {
      onClick();
      onClick();
    });
    expect(await doneDialog()).toHaveTextContent('2 downloaded');
    expect(save).toHaveBeenCalledTimes(2);
    expect(bulk.runBulk).toHaveBeenCalledTimes(1);
    expect(fetched.sort()).toEqual(['d1', 'd2']);
  });

  it('reports a failed retry as skipped', async () => {
    useApi(drafts3.slice(0, 1));
    trackStatus((_id, body) =>
      body.acknowledgeNegative
        ? HttpResponse.json({ success: false, message: 'Server broke' }, { status: 500 })
        : conflict('NEGATIVE_STOCK_ACK_REQUIRED')
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1');
    await user.click(within(bar()!).getByRole('button', { name: 'Mark 1 as sent' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as sent' })
    );
    const ask = await screen.findByRole('dialog', { name: '1 bill shows stock below zero' });
    await user.click(within(ask).getByRole('button', { name: 'Mark as sent anyway' }));
    const done = await doneDialog();
    expect(done).toHaveTextContent('0 marked as sent');
    expect(done).toHaveTextContent('B-1: Server broke');
  });

  it('deletes drafts and cancelled bills; a sent bill and a refused one are skipped', async () => {
    useApi(mixed);
    const deleted: string[] = [];
    server.use(
      http.delete(apiUrl('/businesses/biz-1/bills/:id'), ({ params }) => {
        if (params.id === 'd2')
          return HttpResponse.json({ success: false, message: 'Not allowed' }, { status: 403 });
        deleted.push(String(params.id));
        return ok({});
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Delete 3' }));
    const confirmDialog = screen.getByRole('dialog', { name: 'Delete 3 bills?' });
    expect(confirmDialog).toHaveTextContent("This can't be undone.");
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));
    const done = await doneDialog();
    expect(deleted.sort()).toEqual(['c1', 'd1']);
    expect(done).toHaveTextContent('2 deleted');
    expect(
      within(done)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['B-2: Not allowed', "B-3: can't delete a sent bill"]);
  });

  it('downloads one PDF per selected bill', async () => {
    useApi(mixed);
    const fetched: string[] = [];
    server.use(
      http.get(apiUrl('/businesses/biz-1/bills/:id/pdf'), ({ params }) => {
        fetched.push(String(params.id));
        if (params.id === 'c1')
          return HttpResponse.json({ success: false, message: 'No PDF' }, { status: 404 });
        return new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await user.click(within(bar()!).getByRole('button', { name: 'Download 4 PDFs' }));
    const done = await doneDialog();
    expect(fetched.sort()).toEqual(['c1', 'd1', 'd2', 'p1']);
    expect(done).toHaveTextContent('3 downloaded');
    expect(done).toHaveTextContent('B-4: No PDF');
  });

  it('ticking a checkbox never opens the bill, in the table or the phone list', async () => {
    useApi(mixed);
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1');
    const list = screen.getByRole('list', { name: 'Bills' });
    await user.click(within(list).getByRole('checkbox', { name: 'Select B-2' }));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(bar()).toHaveTextContent('2 bills selected');
  });

  it('offers select all / clear on phones', async () => {
    useApi(mixed);
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
    expect(bar()).toHaveTextContent('4 bills selected');
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('clears the selection when the filter changes', async () => {
    useApi(mixed);
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'B-1', 'B-2');
    expect(bar()).toHaveTextContent('2 bills selected');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'draft');
    await waitFor(() => expect(bar()).not.toBeInTheDocument());
    await waitFor(() => expect(rowNumbers()).toEqual(['B-1', 'B-2']));
    expect(
      within(screen.getByRole('table')).getByRole('checkbox', { name: 'Select B-1' })
    ).not.toBeChecked();
  });

  it('clears the selection when the page changes', async () => {
    const many = Array.from({ length: 27 }, (_, i) =>
      bill({ _id: `m${i}`, billNumber: `M-${String(i + 1).padStart(2, '0')}` })
    );
    useApi(many);
    const { user } = renderPage();
    await screen.findByRole('table');
    await pick(user, 'M-01');
    expect(bar()).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Bills pages' });
    await user.click(within(nav).getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(rowNumbers()).toEqual(['M-26', 'M-27']));
    expect(bar()).not.toBeInTheDocument();
  });
});
