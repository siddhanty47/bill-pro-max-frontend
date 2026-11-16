import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { InventoryPage } from './InventoryPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Inventory } from '../types';

const item = (over: Partial<Inventory>) =>
  ({
    _id: 'i1',
    code: 'SC-01',
    name: 'Cuplock vertical',
    category: 'Scaffolding',
    totalQuantity: 100,
    unit: 'pcs',
    defaultRatePerDay: 1250,
    quantityHistory: [],
    isActive: true,
    ...over,
  }) as unknown as Inventory;

const rentedTx = (qty: number) => ({
  type: 'challan_delivery',
  quantity: qty,
  date: '2026-11-01T00:00:00.000Z',
});

const defaults = [
  item({}),
  item({
    _id: 'i2',
    code: 'PL-02',
    name: 'Steel plank',
    category: 'Planks',
    totalQuantity: 50,
    defaultRatePerDay: 0,
  }),
  item({ _id: 'i3', code: 'SC-03', name: 'Base jack', category: 'Scaffolding' }),
];

function useApi(items: Inventory[] = defaults, opening: Record<string, number> = {}) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => ok(items)),
    http.get(apiUrl('/businesses/biz-1/inventory/opening-balances'), () => ok(opening)),
    http.get(apiUrl('/presets'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/inventory/categories'), () => ok(['Scaffolding'])),
    http.get(apiUrl('/businesses/biz-1/inventory/check-code'), () => ok({ exists: false }))
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<InventoryPage />} />
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

describe('InventoryPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading inventory…')).toBeInTheDocument();
  });

  it('lists items with quantities and formatted rate', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(rowCodes()).toEqual(['SC-01', 'PL-02', 'SC-03']);
    const row = within(table).getByRole('row', { name: /SC-01/ });
    expect(within(row).getByText('Cuplock vertical')).toBeInTheDocument();
    expect(within(row).getByText('Scaffolding')).toBeInTheDocument();
    expect(within(row).getAllByText('100 pcs')).toHaveLength(2);
    expect(within(row).getByText('0 pcs')).toBeInTheDocument();
    expect(within(row).getByText('₹1,250')).toBeInTheDocument();
    const plank = within(table).getByRole('row', { name: /PL-02/ });
    expect(within(plank).getByText('—')).toBeInTheDocument();
  });

  it('computes rented and available from history and opening balances', async () => {
    useApi([item({ quantityHistory: [rentedTx(30)] as never })], { i1: 10 });
    renderPage();
    const table = await screen.findByRole('table');
    const row = within(table).getByRole('row', { name: /SC-01/ });
    expect(within(row).getByText('70 pcs')).toBeInTheDocument();
    expect(within(row).getByText('40 pcs')).toBeInTheDocument();
  });

  it('filters by category', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Planks');
    expect(rowCodes()).toEqual(['PL-02']);
  });

  it('searches by name, code and category', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search inventory' });
    await user.type(search, 'jack');
    expect(rowCodes()).toEqual(['SC-03']);
    await user.clear(search);
    await user.type(search, 'pl-02');
    expect(rowCodes()).toEqual(['PL-02']);
    await user.clear(search);
    await user.type(search, 'scaffold');
    expect(rowCodes()).toEqual(['SC-01', 'SC-03']);
  });

  it('focuses the search box on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search inventory' })).toHaveFocus();
  });

  it('shows filtered-empty and empty states', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search inventory' }), 'zzz');
    expect(screen.getByText('No items match these filters')).toBeInTheDocument();
  });

  it('shows an empty state with no items', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findByText('No inventory items yet')).toBeInTheDocument();
  });

  it('navigates to the item when a row is clicked', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Steel plank'));
    expect(screen.getByTestId('where')).toHaveTextContent('/inventory/i2');
  });

  it('opens the add item modal from the button and Alt+N', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add item/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Add inventory item/);
    await user.click(screen.getByRole('button', { name: /^Cancel/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(document, { code: 'KeyN', altKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('creates an item and closes the modal', async () => {
    useApi();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(apiUrl('/businesses/biz-1/inventory'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(item({ _id: 'i9' }));
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add item/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Item Code/), 'NEW-1');
    await user.type(within(dialog).getByLabelText(/Item Name/), 'New thing');
    await user.type(within(dialog).getByPlaceholderText(/category/i), 'Misc');
    const qtyField = within(dialog).getByLabelText(/Total Quantity/);
    await user.clear(qtyField);
    await user.type(qtyField, '5');
    // empty optional number inputs register as NaN and fail the form's schema
    await user.type(within(dialog).getByLabelText(/Daily Rate/), '10');
    await user.type(within(dialog).getByLabelText(/Damage Charge/), '10');
    await user.type(within(dialog).getByLabelText(/Cost Price/), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Add Item' }));
    await waitFor(() => expect(body).toBeDefined());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('alerts when creating fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses/biz-1/inventory'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add item/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Item Code/), 'NEW-1');
    await user.type(within(dialog).getByLabelText(/Item Name/), 'New thing');
    await user.type(within(dialog).getByPlaceholderText(/category/i), 'Misc');
    const qtyField = within(dialog).getByLabelText(/Total Quantity/);
    await user.clear(qtyField);
    await user.type(qtyField, '5');
    // empty optional number inputs register as NaN and fail the form's schema
    await user.type(within(dialog).getByLabelText(/Daily Rate/), '10');
    await user.type(within(dialog).getByLabelText(/Damage Charge/), '10');
    await user.type(within(dialog).getByLabelText(/Cost Price/), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Add Item' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });

  it('opens the import and create preset modals', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Import preset' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Import Preset/);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Create preset' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create Preset/);
  });

  it('deletes an item after confirming, without navigating', async () => {
    useApi();
    let deleted = '';
    server.use(
      http.delete(apiUrl('/businesses/biz-1/inventory/:id'), ({ params }) => {
        deleted = String(params.id);
        return ok({});
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Steel plank"? This cannot be undone.');
    await waitFor(() => expect(deleted).toBe('i2'));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('does not delete when declined, and alerts when delete fails', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/inventory/:id'), () => {
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

  it('disables delete while items are rented', async () => {
    useApi([item({ quantityHistory: [rentedTx(5)] as never })]);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDisabled();
  });

  it('shows code, category, availability and rate in the phone list', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Inventory' });
    const li = within(list).getByText('Cuplock vertical').closest('li') as HTMLElement;
    expect(within(li).getByText('SC-01')).toBeInTheDocument();
    expect(within(li).getByText('Scaffolding')).toBeInTheDocument();
    expect(within(li).getByText('Available 100 pcs')).toBeInTheDocument();
    expect(within(li).getByText('Rented 0 pcs')).toBeInTheDocument();
    expect(within(li).getByText('₹1,250/day')).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    server.use(
      http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
      http.get(apiUrl('/businesses/biz-1/inventory'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      ),
      http.get(apiUrl('/businesses/biz-1/inventory/opening-balances'), () => ok({}))
    );
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a business when none is selected', () => {
    server.use(http.get(apiUrl('/businesses'), () => ok([])));
    renderWithProviders(<InventoryPage />, { preloadedState: signedIn('') });
    expect(screen.getByText('Please select a business')).toBeInTheDocument();
  });
});
