import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { InventoryPage } from './InventoryPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { UserEvent } from '@testing-library/user-event';
import * as download from '../utils/download';
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
    .map(r => within(r).getAllByRole('cell')[1].textContent);

afterEach(() => vi.restoreAllMocks());

/** Fills and submits the add-item form. */
async function fillForm(user: UserEvent, dialog: HTMLElement, withRates = false) {
  await user.type(within(dialog).getByLabelText(/Item code/), 'NEW-1');
  await user.type(within(dialog).getByLabelText(/Item name/), 'New thing');
  await user.type(within(dialog).getByPlaceholderText(/category/i), 'Misc');
  const qtyField = within(dialog).getByLabelText(/Total quantity/);
  await user.clear(qtyField);
  await user.type(qtyField, '5');
  if (withRates) {
    await user.type(within(dialog).getByLabelText(/Daily rate/), '10');
    await user.type(within(dialog).getByLabelText(/Damage charge/), '11');
    await user.type(within(dialog).getByLabelText(/Cost price/), '12');
  }
  await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
}

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
    await fillForm(user, dialog, true);
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      code: 'NEW-1',
      name: 'New thing',
      category: 'Misc',
      totalQuantity: 5,
      unit: 'pcs',
      defaultRatePerDay: 10,
      damageRate: 11,
      costPrice: 12,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a failed create in a dialog', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses/biz-1/inventory'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add item/ }));
    const dialog = await screen.findByRole('dialog');
    await fillForm(user, dialog);
    expect(await screen.findByRole('dialog', { name: "Couldn't add item" })).toHaveTextContent(
      'Nope'
    );
  });

  it('opens the import and create preset modals', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Import preset' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Import preset/);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Create preset' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Create preset/);
  });

  it('deletes an item after confirming in a dialog, without navigating', async () => {
    useApi();
    let deleted = '';
    server.use(
      http.delete(apiUrl('/businesses/biz-1/inventory/:id'), ({ params }) => {
        deleted = String(params.id);
        return ok({});
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getAllByRole('button', { name: 'More actions' })[1]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const ask = screen.getByRole('dialog', { name: 'Delete Steel plank?' });
    expect(ask).toHaveTextContent("This can't be undone.");
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe('i2'));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('does not delete when cancelled, and shows the error when delete fails', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/inventory/:id'), () => {
        calls++;
        return HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 });
      })
    );
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    const menus = within(table).getAllByRole('button', { name: 'More actions' });
    const ask = () => screen.getByRole('dialog', { name: 'Delete Cuplock vertical?' });
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(ask()).getByRole('button', { name: 'Cancel' }));
    expect(calls).toBe(0);
    await user.click(menus[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(ask()).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('dialog', { name: "Couldn't delete item" })).toHaveTextContent(
      'Nope'
    );
    expect(calls).toBe(1);
  });

  it('disables delete while items are rented', async () => {
    useApi([item({ quantityHistory: [rentedTx(5)] as never })]);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'More actions' }));
    const del = screen.getByRole('menuitem', { name: 'Delete' });
    expect(del).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Items are currently rented')).toBeVisible();
    expect(del).toHaveAccessibleDescription('Items are currently rented');
  });

  it('shows code, category, availability and rate in the phone list', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Inventory' });
    const li = within(list).getByText('Cuplock vertical').closest('li') as HTMLElement;
    expect(within(li).getByText('SC-01')).toBeInTheDocument();
    expect(within(li).getByText('Scaffolding')).toBeInTheDocument();
    expect(li).toHaveTextContent('Available 100 pcs');
    expect(li).toHaveTextContent('Rented 0 pcs');
    expect(within(li).getByText('100 pcs')).toHaveClass('mono');
    expect(within(li).getByText('0 pcs')).toHaveClass('mono');
    expect(within(li).getByText('Available', { exact: false })).not.toHaveClass('mono');
    expect(within(li).getByRole('button', { name: 'More actions' }).closest('.end')).not.toBeNull();
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

  describe('bulk actions', () => {
    afterEach(() => vi.restoreAllMocks());
    const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });
    const selectAll = (user: ReturnType<typeof renderPage>['user']) =>
      user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    const items = (el: HTMLElement) =>
      within(el)
        .getAllByRole('listitem')
        .map(li => li.textContent);
    const rentedPlank = [
      defaults[0],
      item({ ...defaults[1], quantityHistory: [rentedTx(5)] as never }),
      defaults[2],
    ];

    it('exports the selected items with the table columns as plain numbers', async () => {
      useApi(rentedPlank, { i1: 10 });
      const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
      const { user } = renderPage();
      await screen.findByRole('table');
      await screen.findAllByText('10 pcs');
      await selectAll(user);
      expect(bar()).toHaveTextContent('3 items selected');
      await user.click(within(bar()!).getByRole('button', { name: 'Export 3 to CSV' }));
      const [blob, name] = save.mock.calls[0];
      expect(name).toMatch(/^inventory-\d{4}-\d{2}-\d{2}\.csv$/);
      expect((await (blob as Blob).text()).split('\r\n')).toEqual([
        'Code,Name,Category,Unit,Total,Available,Rented,Daily rate',
        'SC-01,Cuplock vertical,Scaffolding,pcs,100,100,10,1250',
        'PL-02,Steel plank,Planks,pcs,50,45,5,',
        'SC-03,Base jack,Scaffolding,pcs,100,100,0,1250',
      ]);
    });

    it('deletes the eligible items; rented ones and server refusals are skipped', async () => {
      useApi(rentedPlank);
      const hits: string[] = [];
      server.use(
        http.delete(apiUrl('/businesses/biz-1/inventory/:id'), ({ params }) => {
          hits.push(String(params.id));
          return params.id === 'i3'
            ? HttpResponse.json({ success: false, message: 'Item is in use' }, { status: 400 })
            : ok({});
        })
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 2' }));
      const ask = screen.getByRole('dialog', { name: 'Delete 2 items?' });
      expect(ask).toHaveTextContent("This can't be undone.");
      await user.click(within(ask).getByRole('button', { name: 'Delete' }));
      const done = await screen.findByRole('dialog', { name: 'Done' });
      expect(hits.sort()).toEqual(['i1', 'i3']);
      expect(done).toHaveTextContent('1 deleted');
      expect(items(done)).toEqual([
        'Steel plank: items are currently rented',
        'Base jack: Item is in use',
      ]);
      await user.click(within(done).getAllByRole('button', { name: 'Close' }).at(-1)!);
      expect(bar()).toHaveTextContent('2 items selected');
    });

    it('disables Delete when every selected item is rented', async () => {
      useApi([item({ quantityHistory: [rentedTx(5)] as never })]);
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(
        within(screen.getByRole('table')).getByRole('checkbox', { name: 'Select Cuplock vertical' })
      );
      expect(bar()).toHaveTextContent('1 item selected');
      expect(within(bar()!).getByRole('button', { name: 'Delete 0' })).toBeDisabled();
      expect(within(bar()!).getByRole('button', { name: 'Export 1 to CSV' })).toBeEnabled();
    });

    it('asks in the singular for one item', async () => {
      useApi();
      server.use(http.delete(apiUrl('/businesses/biz-1/inventory/:id'), () => ok({})));
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(
        within(screen.getByRole('table')).getByRole('checkbox', { name: 'Select Base jack' })
      );
      await user.click(within(bar()!).getByRole('button', { name: 'Delete 1' }));
      await user.click(
        within(screen.getByRole('dialog', { name: 'Delete 1 item?' })).getByRole('button', {
          name: 'Delete',
        })
      );
      expect(await screen.findByRole('dialog', { name: 'Done' })).toHaveTextContent('1 deleted');
    });

    it('select-all covers only the 25 items on the page; a page change clears it', async () => {
      useApi(
        Array.from({ length: 30 }, (_, i) =>
          item({ _id: `m${i}`, code: `C${String(i + 1).padStart(2, '0')}`, name: `Item ${i + 1}` })
        )
      );
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
      expect(bar()).toHaveTextContent('25 items selected');
      const nav = screen.getByRole('navigation', { name: 'Inventory pages' });
      await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
      expect(bar()).not.toBeInTheDocument();
      expect(rowCodes()).toEqual(['C26', 'C27', 'C28', 'C29', 'C30']);
    });

    it('clears the selection when the category changes', async () => {
      useApi();
      const { user } = renderPage();
      await screen.findByRole('table');
      await selectAll(user);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Planks');
      await waitFor(() => expect(bar()).not.toBeInTheDocument());
    });
  });
});
