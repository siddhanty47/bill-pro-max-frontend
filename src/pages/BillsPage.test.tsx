import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BillsPage } from './BillsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import type { Bill, Party } from '../types';

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

const defaults = [
  bill({}),
  bill({
    _id: 'b2',
    billNumber: 'B-2026-27-0002',
    partyId: 'p2',
    totalAmount: 99.5,
    amountPaid: 0,
    status: 'sent',
    drift: { delta: {} as never, detectedAt: '2026-01-01', causes: [] },
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
    .map(r => within(r).getAllByRole('cell')[0].textContent);

// RTK warns that the PDF Blob in the download test is non-serializable; irrelevant here.
const realError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (String(args[0]).includes('non-serializable')) return;
    realError(...args);
  };
});
afterAll(() => {
  console.error = realError;
});

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
    const stale = within(table).getByRole('row', { name: /B-2026-27-0002/ });
    expect(within(stale).getByText('₹99.50')).toBeInTheDocument();
    expect(within(stale).getByText('Stale')).toBeInTheDocument();
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

  it('alerts when sending fails', async () => {
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
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
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

  it('deletes a draft after confirming, and deletes others without force (replaced in Task 12)', async () => {
    useApi();
    const urls: string[] = [];
    server.use(
      http.delete(apiUrl('/businesses/biz-1/bills/:id'), ({ request }) => {
        urls.push(new URL(request.url).search);
        return ok({});
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menus = within(table).getAllByRole('button', { name: 'More actions' });
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(confirmSpy).toHaveBeenLastCalledWith('Delete bill "B-2026-27-0001"?');
    await user.click(menus[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Force delete' }));
    expect(confirmSpy).toHaveBeenLastCalledWith(
      'Bill "B-2026-27-0002" has status "sent". Force delete anyway? This cannot be undone.'
    );
    await waitFor(() => expect(urls).toEqual(['', '']));
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
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
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
