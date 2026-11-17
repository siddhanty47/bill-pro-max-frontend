import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PartiesPage } from './PartiesPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
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
    http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([]))
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
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
    .map(r => within(r).getAllByRole('cell')[0].textContent);

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

  it('deletes a party after confirming, without navigating', async () => {
    useApi();
    let deleted = '';
    server.use(
      http.delete(apiUrl('/businesses/biz-1/parties/:id'), ({ params }) => {
        deleted = String(params.id);
        return ok({});
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(confirmSpy).toHaveBeenCalledWith('Delete party "Steel Traders"?');
    await waitFor(() => expect(deleted).toBe('p2'));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('does not delete when declined, and alerts when delete fails', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/parties/:id'), () => {
        calls++;
        return HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 });
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menus = within(table).getAllByRole('button', { name: 'More actions' });
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(calls).toBe(0);
    confirmSpy.mockReturnValue(true);
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
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
      http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([]))
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
});
