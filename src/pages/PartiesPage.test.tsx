import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PartiesPage } from './PartiesPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import * as download from '../utils/download';
import type { Party } from '../types';

const party = (over: Partial<Party>) =>
  ({
    _id: 'p1',
    businessId: 'biz-1',
    code: 'ACME',
    name: 'Acme Builders',
    roles: ['client'],
    contact: { person: 'Ravi Shah', phone: '9876543210' },
    sites: [
      { code: 'S1', address: 'Andheri' },
      { code: 'S2', address: 'Borivali' },
    ],
    agreements: [{ status: 'active' }, { status: 'closed' }],
    isActive: true,
    ...over,
  }) as unknown as Party;

const defaults = [
  party({}),
  party({
    _id: 'p2',
    code: 'STEEL',
    name: 'Steel Traders',
    roles: ['supplier', 'client'],
    contact: { person: 'Mina Joshi', phone: '9000000002' },
    sites: [{ code: 'T1', address: 'Thane' }],
    agreements: [],
    isActive: false,
  }),
  party({
    _id: 'p3',
    code: 'ZED',
    name: 'Zed Infra',
    roles: ['supplier'],
    contact: { person: 'Omkar Pai', phone: '9000000003' },
  }),
];

function useApi(items: Party[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/parties'), () => ok(items)),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/parties/outstanding'), () =>
      ok({
        totalOutstanding: 18250.5,
        parties: [
          {
            partyId: 'p1',
            partyName: 'Acme Builders',
            partyCode: 'ACME',
            openingBalance: 10000,
            totalBilled: 8250.5,
            totalReceived: 0,
            outstanding: 18250.5,
          },
        ],
        currency: 'INR',
      })
    )
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
      <Route path="/" element={<PartiesPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn() }
  );
}

const rowCodes = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[1].textContent);

afterEach(() => vi.restoreAllMocks());

describe('PartiesPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading parties…')).toBeInTheDocument();
  });

  it('lists parties with roles, contact, counts and status', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(rowCodes()).toEqual(['ACME', 'STEEL', 'ZED']);
    const acme = within(table).getByRole('row', { name: /ACME/ });
    expect(within(acme).getByText('Acme Builders')).toBeInTheDocument();
    expect(within(acme).getByText('Client')).toBeInTheDocument();
    expect(within(acme).getByText('Ravi Shah')).toBeInTheDocument();
    expect(within(acme).getByText('9876543210')).toBeInTheDocument();
    const counts = within(acme).getByTitle('S1, S2');
    expect(counts).toHaveTextContent('2 sites / 1 active');
    expect(within(counts).getByText('2')).toHaveClass('mono');
    expect(within(acme).getByText('Active')).toBeInTheDocument();
    const steel = within(table).getByRole('row', { name: /STEEL/ });
    expect(within(steel).getByText('Supplier, Client')).toBeInTheDocument();
    expect(within(steel).getByText('site', { exact: false })).toHaveTextContent(
      '1 site / 0 active'
    );
    expect(within(steel).getByText('Inactive')).toBeInTheDocument();
  });

  it("shows each party's outstanding (₹0 when it has none)", async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    const acme = within(table).getByRole('row', { name: /ACME/ });
    expect(await within(acme).findByText('₹18,250.50')).toHaveClass('mono');
    const steel = within(table).getByRole('row', { name: /STEEL/ });
    expect(within(steel).getByText('₹0')).toBeInTheDocument();
  });

  it('filters by role', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const role = screen.getByRole('combobox', { name: 'Role' });
    await user.selectOptions(role, 'client');
    expect(rowCodes()).toEqual(['ACME', 'STEEL']);
    await user.selectOptions(role, 'supplier');
    expect(rowCodes()).toEqual(['STEEL', 'ZED']);
  });

  it('searches by name, code and contact person', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search parties' });
    await user.type(search, 'traders');
    expect(rowCodes()).toEqual(['STEEL']);
    await user.clear(search);
    await user.type(search, 'zed');
    expect(rowCodes()).toEqual(['ZED']);
    await user.clear(search);
    await user.type(search, 'ravi');
    expect(rowCodes()).toEqual(['ACME']);
  });

  it('focuses the search box on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search parties' })).toHaveFocus();
  });

  it('shows filtered-empty and empty states', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search parties' }), 'zzz');
    expect(screen.getByText('No parties match these filters')).toBeInTheDocument();
  });

  it('shows an empty state with no parties', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findByText('No parties yet')).toBeInTheDocument();
  });

  it('navigates to the party when a row is clicked', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Steel Traders'));
    expect(screen.getByTestId('where')).toHaveTextContent('/parties/p2');
  });

  it('carries the filtered rows as navigation context when a row is opened', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search parties' }), 'in');
    await waitFor(() => expect(rowCodes()).toHaveLength(2));
    await user.click(within(screen.getByRole('table')).getByText('Steel Traders'));
    const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
    expect(recordNav.paths).toHaveLength(2);
    expect(recordNav.paths).toContain('/parties/p2');
  });

  it('opens the add party modal from the button and Alt+N', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add party/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add party');
    await user.click(screen.getByRole('button', { name: /^Cancel/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(document, { code: 'KeyN', altKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('has no primary row button; actions live in the menu', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByRole('row', { name: /ACME/ });
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'Add site',
      'Add agreement',
      'Delete',
    ]);
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('opens the add site modal for the party', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Add site' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add site to Steel Traders');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('opens the add agreement modal for the party', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Add agreement' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add agreement for Acme Builders');
  });

  it('deletes a party after confirming in a dialog, without navigating', async () => {
    useApi();
    let deleted = '';
    server.use(
      http.delete(apiUrl('/businesses/biz-1/parties/:id'), ({ params }) => {
        deleted = String(params.id);
        return ok({});
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const ask = screen.getByRole('dialog', { name: 'Delete Steel Traders?' });
    expect(ask).toHaveTextContent("This can't be undone.");
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe('p2'));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('does not delete when cancelled, and shows the error when delete fails', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/parties/:id'), () => {
        calls++;
        return HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 });
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menus = within(table).getAllByRole('button', { name: 'More actions' });
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete Acme Builders?' })).getByRole('button', {
        name: 'Cancel',
      })
    );
    expect(calls).toBe(0);
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete Acme Builders?' })).getByRole('button', {
        name: 'Delete',
      })
    );
    const failed = await screen.findByRole('dialog', { name: "Couldn't delete party" });
    expect(failed).toHaveTextContent('Nope');
    expect(calls).toBe(1);
    await user.click(within(failed).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows code, status, roles, counts and phone in the phone list', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Parties' });
    const li = within(list).getByText('Acme Builders').closest('li') as HTMLElement;
    expect(within(li).getByText('ACME')).toBeInTheDocument();
    expect(within(li).getByText('Ravi Shah')).toBeInTheDocument();
    expect(within(li).getByText('Active')).toBeInTheDocument();
    expect(within(li).getByText('Client')).toBeInTheDocument();
    expect(li).toHaveTextContent('2 sites');
    expect(li).toHaveTextContent('1 active');
    expect(within(li).getByText('2')).toHaveClass('mono');
    expect(within(li).getByText('9876543210')).toHaveClass('mono');
    expect(within(li).getByText('Client')).not.toHaveClass('mono');
    expect(within(li).getByRole('button', { name: 'More actions' }).closest('.end')).not.toBeNull();
  });

  it('shows an error with retry when loading fails', async () => {
    server.use(
      http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
      http.get(apiUrl('/businesses/biz-1/parties'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      ),
      http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([])),
      http.get(apiUrl('/businesses/biz-1/parties/outstanding'), () =>
        ok({ totalOutstanding: 0, parties: [], currency: 'INR' })
      )
    );
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a business when none is selected', () => {
    server.use(http.get(apiUrl('/businesses'), () => ok([])));
    renderWithProviders(<PartiesPage />, { preloadedState: signedIn('') });
    expect(screen.getByText('Please select a business')).toBeInTheDocument();
  });

  describe('bulk actions', () => {
    afterEach(() => vi.restoreAllMocks());
    const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });
    const doneDialog = () => screen.findByRole('dialog', { name: 'Done' });
    const selectAll = (user: ReturnType<typeof renderPage>['user']) =>
      user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    const tick = (user: ReturnType<typeof renderPage>['user'], name: string) =>
      user.click(
        within(screen.getByRole('table')).getByRole('checkbox', { name: `Select ${name}` })
      );
    const items = (el: HTMLElement) =>
      within(el)
        .getAllByRole('listitem')
        .map(li => li.textContent);
    function trackDeletes(reply: (id: string) => Response | undefined = () => undefined) {
      const hits: string[] = [];
      server.use(
        http.delete(apiUrl('/businesses/biz-1/parties/:id'), ({ params }) => {
          const id = String(params.id);
          hits.push(id);
          return reply(id) ?? ok({});
        })
      );
      return hits;
    }

    it('exports the selected parties with the table columns, outstanding as a number', async () => {
      useApi();
      const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
      const { user } = renderPage();
      await screen.findByRole('table');
      await screen.findAllByText('₹18,250.50');
      await selectAll(user);
      expect(bar()).toHaveTextContent('3 parties selected');
      await user.click(within(bar()!).getByRole('button', { name: 'Export 3 to CSV' }));
      const [blob, name] = save.mock.calls[0];
      expect(name).toMatch(/^parties-\d{4}-\d{2}-\d{2}\.csv$/);
      expect((await (blob as Blob).text()).split('\r\n')).toEqual([
        'Code,Name,Roles,Contact person,Phone,Sites,Active agreements,Outstanding,Status',
        'ACME,Acme Builders,Client,Ravi Shah,9876543210,2,1,18250.5,Active',
        'STEEL,Steel Traders,"Supplier, Client",Mina Joshi,9000000002,1,0,0,Inactive',
        'ZED,Zed Infra,Supplier,Omkar Pai,9000000003,2,1,0,Active',
      ]);
    });

    it('a name with a comma, a quote, a newline or a leading = exports safely', async () => {
      useApi([party({ name: '=Shah, "Ravi"\nCo' })]);
      const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
      const { user } = renderPage();
      await screen.findByRole('table');
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Export 1 to CSV' }));
      const text = await (save.mock.calls[0][0] as Blob).text();
      expect(text.split('\r\n')[1]).toBe(
        'ACME,"\'=Shah, ""Ravi""\nCo",Client,Ravi Shah,9876543210,2,1,18250.5,Active'
      );
    });

    it('deletes the selected parties; a server refusal is skipped with its message', async () => {
      useApi();
      const hits = trackDeletes(id =>
        id === 'p2'
          ? HttpResponse.json(
              { success: false, message: 'Party has agreements and cannot be deleted' },
              { status: 400 }
            )
          : undefined
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 3' }));
      const ask = screen.getByRole('dialog', { name: 'Delete 3 parties?' });
      expect(ask).toHaveTextContent("This can't be undone.");
      await user.click(within(ask).getByRole('button', { name: 'Delete' }));
      const done = await doneDialog();
      expect(hits.sort()).toEqual(['p1', 'p2', 'p3']);
      expect(done).toHaveTextContent('2 deleted');
      expect(items(done)).toEqual(['Steel Traders: Party has agreements and cannot be deleted']);
      expect(done.querySelector('li .mono')).toBeNull();
      await user.click(within(done).getAllByRole('button', { name: 'Close' }).at(-1)!);
      expect(bar()).toHaveTextContent('1 party selected');
    });

    it('asks in the singular and does nothing on Cancel', async () => {
      useApi();
      const hits = trackDeletes();
      const { user } = renderPage();
      await screen.findByRole('table');
      expect(bar()).not.toBeInTheDocument();
      await tick(user, 'Zed Infra');
      expect(bar()).toHaveTextContent('1 party selected');
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 1' }));
      const ask = screen.getByRole('dialog', { name: 'Delete 1 party?' });
      await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(hits).toEqual([]);
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 1' }));
      await user.click(
        within(screen.getByRole('dialog', { name: 'Delete 1 party?' })).getByRole('button', {
          name: 'Delete',
        })
      );
      expect(await doneDialog()).toHaveTextContent('1 deleted');
      expect(hits).toEqual(['p3']);
    });

    const thirty = Array.from({ length: 30 }, (_, i) =>
      party({ _id: `m${i}`, code: `C${String(i + 1).padStart(2, '0')}`, name: `Party ${i + 1}` })
    );

    it('select-all covers only the 25 parties on the page; a page change clears it', async () => {
      useApi(thirty);
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
      expect(bar()).toHaveTextContent('25 parties selected');
      const nav = screen.getByRole('navigation', { name: 'Parties pages' });
      await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
      expect(bar()).not.toBeInTheDocument();
      expect(rowCodes()).toEqual(['C26', 'C27', 'C28', 'C29', 'C30']);
      await user.click(within(screen.getByRole('table')).getByText('Party 27'));
      const { recordNav } = JSON.parse(screen.getByTestId('state').textContent ?? '');
      expect(recordNav.paths).toHaveLength(30);
    });

    it('clears the selection when the search changes', async () => {
      useApi();
      const { user } = renderPage();
      await screen.findByRole('table');
      await tick(user, 'Acme Builders');
      expect(bar()).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: 'Search parties' }), 'a');
      await waitFor(() => expect(bar()).not.toBeInTheDocument());
    });
  });
});
