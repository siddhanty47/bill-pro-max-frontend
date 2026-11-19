import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ChallansPage } from './ChallansPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import type { Challan, ChallanItem, Party } from '../types';

const party = (over: Partial<Party>) =>
  ({
    _id: 'p1',
    name: 'Mehta Builders',
    isActive: true,
    agreements: [{ agreementId: 'a1', siteCode: 'PLOT' }],
    sites: [],
    ...over,
  }) as unknown as Party;

const items = (n: number) => Array.from({ length: n }, () => ({}) as ChallanItem);

const challan = (over: Partial<Challan>) =>
  ({
    _id: 'c1',
    challanNumber: 'D-2026-27-0007',
    type: 'delivery',
    partyId: 'p1',
    agreementId: 'a1',
    date: '2026-11-16T00:00:00.000Z',
    items: items(4),
    status: 'draft',
    ...over,
  }) as unknown as Challan;

const defaults = [
  challan({}),
  challan({
    _id: 'c2',
    challanNumber: 'R-2026-27-0003',
    type: 'return',
    partyId: 'p2',
    agreementId: 'a2',
    date: '2026-11-18T00:00:00.000Z',
    items: items(2),
    status: 'confirmed',
  }),
  challan({
    _id: 'c3',
    challanNumber: 'D-2026-27-0005',
    date: '2026-11-10T00:00:00.000Z',
    items: items(1),
    status: 'cancelled',
  }),
];

const PARTY_NAMES: Record<string, string> = { p1: 'Mehta Builders', p2: 'Om Constructions' };

/** The backend's challan list filters: type, status, and search on number or party name. */
function matchChallan(c: Challan, q: URLSearchParams): boolean {
  const search = q.get('search')?.toLowerCase();
  return (
    (!q.get('type') || c.type === q.get('type')) &&
    (!q.get('status') || c.status === q.get('status')) &&
    (!search ||
      c.challanNumber.toLowerCase().includes(search) ||
      (PARTY_NAMES[c.partyId] ?? '').toLowerCase().includes(search))
  );
}

function useApi(challans: Challan[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    // Behaves like the backend: newest date first, filters and search applied server-side.
    http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) =>
      pagedOk(
        [...challans].sort((a, b) => b.date.localeCompare(a.date)),
        request,
        matchChallan
      )
    ),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([
        party({}),
        party({
          _id: 'p2',
          name: 'Om Constructions',
          agreements: [{ agreementId: 'a2', siteCode: 'SECT' }] as Party['agreements'],
        }),
      ])
    ),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([])),
    // requested by the create modal's form
    http.get(apiUrl('/businesses/biz-1/challans/next-number'), () => ok('D-2026-27-0008')),
    http.get(apiUrl('/businesses/biz-1/employees'), () => ok([]))
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ChallansPage />} />
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

afterEach(() => vi.restoreAllMocks());

describe('ChallansPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading challans…')).toBeInTheDocument();
  });

  it('lists both types in one table, newest date first', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    expect(rowNumbers()).toEqual(['R-2026-27-0003', 'D-2026-27-0007', 'D-2026-27-0005']);
    const row = within(screen.getByRole('table')).getByRole('row', { name: /D-2026-27-0007/ });
    expect(within(row).getByText('Delivery')).toBeInTheDocument();
    expect(within(row).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(row).getByText('PLOT')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(within(row).getByText('Draft')).toBeInTheDocument();
  });

  it('offers Confirm only on drafts', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
  });

  it('segmented Delivery hides returns, Return hides deliveries, All restores', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('radio', { name: 'Delivery' }));
    await waitFor(() => expect(rowNumbers()).toEqual(['D-2026-27-0007', 'D-2026-27-0005']));
    await user.click(screen.getByRole('radio', { name: 'Return' }));
    await waitFor(() => expect(rowNumbers()).toEqual(['R-2026-27-0003']));
    await user.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(rowNumbers()).toHaveLength(3));
  });

  it('filters by status', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'confirmed');
    await waitFor(() => expect(rowNumbers()).toEqual(['R-2026-27-0003']));
  });

  it('searches by party name and by challan number', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search challans' });
    await user.type(search, 'om cons');
    await waitFor(() => expect(rowNumbers()).toEqual(['R-2026-27-0003']));
    await user.clear(search);
    await user.type(search, '0005');
    await waitFor(() => expect(rowNumbers()).toEqual(['D-2026-27-0005']));
  });

  it('focuses the search box on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search challans' })).toHaveFocus();
  });

  it('shows a filtered-empty state', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search challans' }), 'zzz');
    expect(await screen.findByText('No challans match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state whose action opens the delivery modal', async () => {
    useApi([]);
    const { user } = renderPage();
    expect(await screen.findByText('No challans yet')).toBeInTheDocument();
    const empty = screen.getByText('No challans yet').parentElement as HTMLElement;
    await user.click(within(empty).getByRole('button', { name: /New delivery/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('confirms a draft after the prompt without navigating', async () => {
    useApi();
    let body: unknown;
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans/c1/confirm'), async ({ request }) => {
        body = await request.json();
        return ok(challan({ status: 'confirmed' }));
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    expect(confirmSpy).toHaveBeenCalledWith('Confirm challan D-2026-27-0007?');
    await waitFor(() => expect(body).toEqual({ confirmedBy: 'Unknown' }));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('does not confirm when the prompt is declined', async () => {
    useApi();
    let called = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans/c1/confirm'), () => {
        called = true;
        return ok(challan({}));
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    expect(called).toBe(false);
  });

  it('alerts when confirming fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans/c1/confirm'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });

  it('navigates to the challan when a row is clicked', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Om Constructions'));
    expect(screen.getByTestId('where')).toHaveTextContent('/challans/c2');
  });

  it('opens the delivery and return modals from the header buttons', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /New delivery/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create delivery challan/);
    await user.click(screen.getByRole('button', { name: /^Cancel/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New return/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create return challan/);
  });

  it('names the type in the phone list', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Challans' });
    const item = within(list).getByText('R-2026-27-0003').closest('li') as HTMLElement;
    expect(item).toHaveTextContent(/Return · SECT · 18 Nov/);
  });

  it('opens the modals with Alt+D and Alt+R', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'KeyD', altKey: true });
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create delivery challan/);
  });

  it('opens the return modal with Alt+R', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'KeyR', altKey: true });
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create return challan/);
  });

  it('asks the server for one page with the active filters', async () => {
    const seen: string[] = [];
    useApi();
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/biz-1/challans')) seen.push(url.search);
    });
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('radio', { name: 'Return' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'confirmed');
    await user.type(screen.getByRole('searchbox', { name: 'Search challans' }), 'om');
    await waitFor(() =>
      expect(seen.at(-1)).toBe('?page=1&pageSize=25&search=om&status=confirmed&type=return')
    );
    expect(seen[0]).toBe('?page=1&pageSize=25');
    server.events.removeAllListeners();
  });

  it('pages through challans with the server total', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      challan({
        _id: `c${i}`,
        challanNumber: `D-2026-27-${String(i + 1).padStart(4, '0')}`,
        date: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        status: 'confirmed',
      })
    );
    useApi(many);
    const { user } = renderPage();
    await screen.findByRole('table');
    const nav = screen.getByRole('navigation', { name: 'Challans pages' });
    expect(nav).toHaveTextContent('Showing 1–25 of 30');
    expect(rowNumbers()).toHaveLength(25);

    await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(rowNumbers()).toHaveLength(5));
    expect(rowNumbers()[0]).toBe('D-2026-27-0005');
    expect(nav).toHaveTextContent('Showing 26–30 of 30');

    // A new filter starts again from page 1.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'confirmed');
    await waitFor(() => expect(rowNumbers()).toHaveLength(25));
  });

  it('shows an error with retry when loading fails', async () => {
    server.use(
      http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
      http.get(apiUrl('/businesses/biz-1/challans'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      ),
      http.get(apiUrl('/businesses/biz-1/parties'), () => ok([])),
      http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([]))
    );
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a business when none is selected', () => {
    server.use(http.get(apiUrl('/businesses'), () => ok([])));
    renderWithProviders(<ChallansPage />, { preloadedState: signedIn('') });
    expect(screen.getByText('Please select a business')).toBeInTheDocument();
  });
});
