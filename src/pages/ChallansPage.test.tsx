import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ChallansPage } from './ChallansPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import type { Challan, ChallanItem, GateReport, Party } from '../types';

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

const CLEAN: GateReport = { affected: [], negative: [], requiresReason: false, blocked: null };

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
    // cell 0 is the selection checkbox
    .map(r => within(r).getAllByRole('cell')[1].textContent);

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
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans/c1/confirm'), async ({ request }) => {
        bodies.push(await request.json());
        if (new URL(request.url).searchParams.get('dryRun') === 'true')
          return ok({ dryRun: true, report: CLEAN });
        return ok(challan({ status: 'confirmed' }));
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm challan D-2026-27-0007?' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ confirmedBy: 'Unknown' });
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
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('shows a message when confirming fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans/c1/confirm'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Confirm' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    const dialog = await screen.findByRole('dialog', { name: "Couldn't confirm challan" });
    expect(dialog).toHaveTextContent('Nope');
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to the challan when a row is clicked', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Om Constructions'));
    expect(screen.getByTestId('where')).toHaveTextContent('/challans/c2');
  });

  it('carries the filtered list as navigation context when a row is opened', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search challans' }), 'D-');
    await waitFor(() => expect(rowNumbers()).toEqual(['D-2026-27-0007', 'D-2026-27-0005']));
    await user.click(within(screen.getByRole('table')).getByText('D-2026-27-0005'));
    expect(screen.getByTestId('where')).toHaveTextContent('/challans/c3');
    const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
    expect(recordNav.paths).toEqual(['/challans/c1', '/challans/c3']);
    expect(recordNav.index).toBe(1);
    expect(recordNav.server.page).toBe(1);
    expect(recordNav.server.source.list).toBe('challans');
    expect(recordNav.server.source.args.search).toBe('D-');
    expect(recordNav.server.source.args.businessId).toBe('biz-1');
  });

  it('gives stale rows page-only context while a new search is in flight', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    let inFlight = false;
    server.use(
      http.get(apiUrl('/businesses/biz-1/challans'), async () => {
        inFlight = true;
        await delay(400);
        return pagedOk([], new Request('http://x/?page=1&pageSize=25'));
      })
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search challans' }), 'D');
    await waitFor(() => expect(inFlight).toBe(true));
    const table = screen.getByRole('table');
    await user.click(within(table).getAllByRole('link')[0]);
    const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
    expect(recordNav.paths.length).toBeGreaterThan(1);
    expect(recordNav.server).toBeUndefined();
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

  describe('bulk actions', () => {
    const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });
    const doneDialog = () => screen.findByRole('dialog', { name: 'Done' });
    const conflict = (code: string, details?: Record<string, unknown>) =>
      HttpResponse.json(
        { success: false, error: { code, message: `${code} message`, details } },
        { status: 409 }
      );
    const drafts = [
      challan({ _id: 'd1', challanNumber: 'D-1', date: '2026-11-20T00:00:00.000Z' }),
      challan({ _id: 'd2', challanNumber: 'D-2', date: '2026-11-19T00:00:00.000Z' }),
      challan({ _id: 'd3', challanNumber: 'D-3', date: '2026-11-18T00:00:00.000Z' }),
      challan({
        _id: 'k1',
        challanNumber: 'D-4',
        date: '2026-11-17T00:00:00.000Z',
        status: 'confirmed',
      }),
    ];
    type Reply = (id: string, dryRun: boolean) => Response | undefined;
    /** Records every confirm call; `reply` may override the default clean dry run / success. */
    function trackConfirm(reply: Reply = () => undefined) {
      const calls: { id: string; dryRun: boolean; body: unknown }[] = [];
      server.use(
        http.post(apiUrl('/businesses/biz-1/challans/:id/confirm'), async ({ params, request }) => {
          const id = String(params.id);
          const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
          calls.push({ id, dryRun, body: await request.json() });
          return (
            reply(id, dryRun) ??
            (dryRun
              ? ok({ dryRun: true, report: CLEAN })
              : ok(challan({ _id: id, status: 'confirmed' })))
          );
        })
      );
      return calls;
    }
    const real = (calls: { id: string; dryRun: boolean }[]) =>
      calls
        .filter(c => !c.dryRun)
        .map(c => c.id)
        .sort();

    it('shows no bar until a challan is ticked, then counts drafts on the buttons', async () => {
      useApi(drafts);
      const { user } = renderPage();
      const table = await screen.findByRole('table');
      expect(bar()).not.toBeInTheDocument();
      await user.click(within(table).getByRole('checkbox', { name: 'Select D-4' }));
      expect(bar()).toHaveTextContent('1 challan selected');
      expect(within(bar()!).getByRole('button', { name: 'Confirm 0' })).toBeDisabled();
      expect(within(bar()!).getByRole('button', { name: 'Download 1 PDF' })).toBeEnabled();
      await user.click(within(table).getByRole('checkbox', { name: 'Select D-1' }));
      expect(bar()).toHaveTextContent('2 challans selected');
      expect(within(bar()!).getByRole('button', { name: 'Confirm 1' })).toBeEnabled();
    });

    it('confirms clean drafts and skips one whose dry run touches a bill, with no change dialog', async () => {
      useApi(drafts);
      const calls = trackConfirm((id, dryRun) =>
        dryRun && id === 'd2'
          ? ok({
              dryRun: true,
              report: {
                ...CLEAN,
                affected: [{ billId: 'b1', billNumber: 'B-1', status: 'sent' }],
                requiresReason: true,
              },
            })
          : undefined
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 3' }));
      const ask = screen.getByRole('dialog', { name: 'Confirm 3 challans?' });
      await user.click(within(ask).getByRole('button', { name: 'Confirm' }));
      const done = await doneDialog();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(done).toHaveTextContent('2 confirmed');
      expect(
        within(done)
          .getAllByRole('listitem')
          .map(li => li.textContent)
      ).toEqual(['D-2: needs a check, open it to confirm', 'D-4: already confirmed']);
      expect(real(calls)).toEqual(['d1', 'd3']);
      expect(
        calls
          .filter(c => c.dryRun)
          .map(c => c.id)
          .sort()
      ).toEqual(['d1', 'd2', 'd3']);
      expect(calls.every(c => (c.body as { confirmedBy: string }).confirmedBy === 'Unknown')).toBe(
        true
      );
      await user.click(within(done).getAllByRole('button', { name: 'Close' }).at(-1)!);
      // Skipped challans stay selected; confirmed ones leave the selection.
      expect(bar()).toHaveTextContent('2 challans selected');
    });

    it('skips negative stock and role blocks as needing a check, closed years as year closed', async () => {
      useApi(drafts.slice(0, 3));
      const calls = trackConfirm((id, dryRun) => {
        if (!dryRun) return undefined;
        if (id === 'd1')
          return ok({
            dryRun: true,
            report: { ...CLEAN, negative: [{ itemId: 'i1' }] },
          });
        if (id === 'd2')
          return ok({
            dryRun: true,
            report: { ...CLEAN, blocked: 'closedYear', closedYear: '2025-26' },
          });
        return ok({ dryRun: true, report: { ...CLEAN, blocked: 'role' } });
      });
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 3' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
      const done = await doneDialog();
      expect(done).toHaveTextContent('0 confirmed');
      expect(
        within(done)
          .getAllByRole('listitem')
          .map(li => li.textContent)
      ).toEqual([
        'D-1: needs a check, open it to confirm',
        'D-2: year closed',
        'D-3: needs a check, open it to confirm',
      ]);
      expect(real(calls)).toEqual([]);
    });

    it('turns refusals from the server into skip reasons', async () => {
      useApi(drafts.slice(0, 3));
      trackConfirm((id, dryRun) => {
        if (id === 'd1' && dryRun) return conflict('YEAR_CLOSED', { fy: '2025-26' });
        if (id === 'd2' && !dryRun) return conflict('REASON_REQUIRED');
        if (id === 'd3' && !dryRun)
          return HttpResponse.json({ success: false, message: 'Server broke' }, { status: 500 });
        return undefined;
      });
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 3' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
      const done = await doneDialog();
      expect(
        within(done)
          .getAllByRole('listitem')
          .map(li => li.textContent)
      ).toEqual([
        'D-1: year closed',
        'D-2: needs a check, open it to confirm',
        'D-3: Server broke',
      ]);
    });

    it('deletes selected drafts and skips confirmed and cancelled ones', async () => {
      useApi([
        ...drafts,
        challan({
          _id: 'x1',
          challanNumber: 'D-9',
          date: '2026-11-16T00:00:00.000Z',
          status: 'cancelled',
        }),
      ]);
      const deleted: string[] = [];
      server.use(
        http.delete(apiUrl('/businesses/biz-1/challans/:id'), ({ params }) => {
          if (params.id === 'd3') {
            return HttpResponse.json(
              { success: false, error: { message: 'Gone already' } },
              { status: 404 }
            );
          }
          deleted.push(String(params.id));
          return ok({ id: params.id });
        })
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 3' }));
      const ask = screen.getByRole('dialog', { name: 'Delete 3 draft challans?' });
      await user.click(within(ask).getByRole('button', { name: 'Delete' }));
      const done = await doneDialog();
      expect(done).toHaveTextContent('2 deleted');
      expect(
        within(done)
          .getAllByRole('listitem')
          .map(li => li.textContent)
      ).toEqual(['D-3: Gone already', 'D-4: confirmed, open it to cancel', 'D-9: cancelled']);
      expect(deleted.sort()).toEqual(['d1', 'd2']);
    });

    it('skips a challan whose dry run comes back without a report', async () => {
      useApi(drafts.slice(0, 2));
      const calls = trackConfirm((id, dryRun) =>
        id === 'd1' && dryRun ? ok(challan({ _id: 'd1', status: 'confirmed' })) : undefined
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 2' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
      const done = await doneDialog();
      expect(done).toHaveTextContent('1 confirmed');
      expect(
        within(done)
          .getAllByRole('listitem')
          .map(li => li.textContent)
      ).toEqual(['D-1: needs a check, open it to confirm']);
      expect(real(calls)).toEqual(['d2']);
    });

    it('uses the singular in the confirm title and skips cancelled challans', async () => {
      useApi([drafts[0], challan({ _id: 'x1', challanNumber: 'D-9', status: 'cancelled' })]);
      trackConfirm();
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 1' }));
      await user.click(
        within(screen.getByRole('dialog', { name: 'Confirm 1 challan?' })).getByRole('button', {
          name: 'Confirm',
        })
      );
      const done = await doneDialog();
      expect(done).toHaveTextContent('1 confirmed');
      expect(done).toHaveTextContent('D-9: cancelled');
    });

    it('downloads one PDF per selected challan, named like the single download', async () => {
      useApi(drafts);
      const fetched: string[] = [];
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans/:id/pdf'), ({ params }) => {
          fetched.push(String(params.id));
          if (params.id === 'd2')
            return HttpResponse.json({ success: false, message: 'No PDF' }, { status: 404 });
          return new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } });
        })
      );
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      const names: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        names.push(this.download);
      });
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Download 4 PDFs' }));
      const done = await doneDialog();
      expect(fetched.sort()).toEqual(['d1', 'd2', 'd3', 'k1']);
      expect(names.sort()).toEqual(['challan-D-1.pdf', 'challan-D-3.pdf', 'challan-D-4.pdf']);
      expect(done).toHaveTextContent('3 downloaded');
      expect(done).toHaveTextContent('D-2: No PDF');
    });

    it('clears the selection when a filter changes', async () => {
      useApi(drafts);
      const { user } = renderPage();
      const table = await screen.findByRole('table');
      await user.click(within(table).getByRole('checkbox', { name: 'Select D-1' }));
      expect(bar()).toBeInTheDocument();
      await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'draft');
      await waitFor(() => expect(bar()).not.toBeInTheDocument());
    });

    it('clears the selection when the page changes', async () => {
      const many = Array.from({ length: 27 }, (_, i) =>
        challan({
          _id: `m${i}`,
          challanNumber: `M-${String(i + 1).padStart(2, '0')}`,
          date: `2026-10-${String(28 - i).padStart(2, '0')}T00:00:00.000Z`,
        })
      );
      useApi(many);
      const { user } = renderPage();
      const table = await screen.findByRole('table');
      await user.click(within(table).getByRole('checkbox', { name: 'Select M-01' }));
      expect(bar()).toHaveTextContent('1 challan selected');
      const nav = screen.getByRole('navigation', { name: 'Challans pages' });
      await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
      await waitFor(() => expect(rowNumbers()).toEqual(['M-26', 'M-27']));
      expect(bar()).not.toBeInTheDocument();
    });

    it('offers select all / clear on phones for the visible page', async () => {
      useApi(drafts);
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
      expect(bar()).toHaveTextContent('4 challans selected');
      expect(within(bar()!).getByRole('button', { name: 'Confirm 3' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Clear selection' }));
      expect(bar()).not.toBeInTheDocument();
    });

    it('says what bulk confirm does before it runs', async () => {
      useApi(drafts);
      const calls = trackConfirm();
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
      await user.click(within(bar()!).getByRole('button', { name: 'Confirm 3' }));
      const ask = screen.getByRole('dialog', { name: 'Confirm 3 challans?' });
      expect(ask).toHaveTextContent(
        "Each challan's stock moves are saved. Challans that need a check are skipped."
      );
      await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(calls).toEqual([]);
    });
  });

  it('asks for a business when none is selected', () => {
    server.use(http.get(apiUrl('/businesses'), () => ok([])));
    renderWithProviders(<ChallansPage />, { preloadedState: signedIn('') });
    expect(screen.getByText('Please select a business')).toBeInTheDocument();
  });
});
