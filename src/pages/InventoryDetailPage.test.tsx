import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { InventoryDetailPage } from './InventoryDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Inventory } from '../types';

const BASE = '/businesses/biz-1/inventory/i1';

const makeItem = (over: Partial<Inventory> = {}): Inventory =>
  ({
    _id: 'i1',
    businessId: 'biz-1',
    code: 'SC-01',
    name: 'Cuplock vertical',
    category: 'Scaffolding',
    totalQuantity: 100,
    unit: 'pcs',
    description: 'Standard 2m vertical',
    defaultRatePerDay: 1250,
    damageRate: 150,
    costPrice: 900,
    isActive: true,
    createdAt: '2025-11-01T08:00:00.000Z',
    updatedAt: '2025-11-02T08:00:00.000Z',
    purchaseInfo: {
      supplierName: 'Shree Steel',
      costPerUnit: 850.5,
      date: '2025-10-20T00:00:00.000Z',
      paymentStatus: 'partial',
    },
    quantityHistory: [
      { _id: 't1', type: 'purchase', quantity: 100, date: '2025-10-20T00:00:00.000Z' },
      {
        _id: 't2',
        type: 'challan_delivery',
        quantity: 30,
        date: '2025-11-05T00:00:00.000Z',
        note: 'Site A',
      },
      { _id: 't3', type: 'scraped', quantity: 2, date: '2025-11-08T00:00:00.000Z' },
    ],
    ...over,
  }) as unknown as Inventory;

function useApi(item: Inventory = makeItem(), opening: Record<string, number> = { i1: 5 }) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(item)),
    http.get(apiUrl('/businesses/biz-1/inventory/opening-balances'), () => ok(opening)),
    http.get(apiUrl('/businesses/biz-1/inventory/categories'), () => ok(['Scaffolding', 'Planks']))
  );
}

/** Captures bodies sent with `method` to `path`. */
function capture(method: 'patch' | 'post', path: string, status = 200) {
  const bodies: unknown[] = [];
  server.use(
    http[method](apiUrl(path), async ({ request }) => {
      bodies.push(await request.json());
      if (status !== 200) {
        return HttpResponse.json(
          { success: false, error: { message: 'Cannot reduce below rented' } },
          { status }
        );
      }
      return ok(makeItem());
    })
  );
  return bodies;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/inventory/:itemId" element={<InventoryDetailPage />} />
      <Route path="*" element={<div>elsewhere</div>} />
    </Routes>,
    { preloadedState: signedIn(), route: '/inventory/i1' }
  );
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: RegExp) {
  await user.click(await screen.findByRole('tab', { name }));
}

const section = (name: string) => screen.getByRole('heading', { name }).closest('section')!;
const rowValue = (root: HTMLElement, label: string) =>
  within(root).getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!;

afterEach(() => vi.restoreAllMocks());

describe('InventoryDetailPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading item…')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json({ success: false, error: { message: 'Item not found' } }, { status: 404 })
      )
    );
    renderPage();
    expect(await screen.findByText(/Item not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again|Retry/ })).toBeInTheDocument();
  });

  it('renders the header, status once and tabs with counts', async () => {
    useApi();
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Cuplock vertical', level: 1 })
    ).toBeVisible();
    expect(screen.getByText('SC-01', { selector: 'p .mono, span.mono' })).toBeVisible();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Inventory' })).toHaveAttribute(
      'href',
      '/inventory'
    );
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'About',
      'Quantity timeline 3',
      'Change history',
    ]);
  });

  it('shows an inactive item with a single chip', async () => {
    useApi(makeItem({ isActive: false }));
    renderPage();
    await screen.findByRole('heading', { name: 'Cuplock vertical', level: 1 });
    expect(screen.getAllByText('Inactive')).toHaveLength(1);
  });

  it('shows stock with the list page numbers, mono counts and plain units', async () => {
    useApi();
    renderPage();
    const stock = await waitFor(() => section('Stock'));
    // available = 100 - 30 rented; rented = 30 + 5 opening balance
    expect(rowValue(stock, 'Total quantity')).toHaveTextContent('100 pcs');
    expect(rowValue(stock, 'Available')).toHaveTextContent('70 pcs');
    await waitFor(() => expect(rowValue(stock, 'Rented out')).toHaveTextContent('35 pcs'));
    expect(within(rowValue(stock, 'Rented out')).getByText('35')).toHaveClass('mono');
    expect(within(rowValue(stock, 'Rented out')).queryByText('pcs')).not.toHaveClass('mono');
    expect(
      within(stock).getByRole('img', { name: 'Available 70 of 105, Rented out 35 of 105' })
    ).toBeInTheDocument();
  });

  it('shows details in the sidebar without a status row', async () => {
    useApi();
    renderPage();
    const details = await waitFor(() => section('Details'));
    expect(within(details).getByText('SC-01')).toHaveClass('mono');
    expect(within(details).getByRole('button', { name: /Scaffolding/ })).toBeVisible();
    expect(within(details).getByRole('button', { name: /Pieces/ })).toBeVisible();
    expect(within(details).getByRole('button', { name: /₹1,250/ })).toHaveClass('mono');
    expect(within(details).getByRole('button', { name: /₹150/ })).toHaveClass('mono');
    expect(within(details).getByRole('button', { name: /₹900/ })).toHaveClass('mono');
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByText('1 Nov 2025')).toBeInTheDocument();
    expect(within(details).getByText('2 Nov 2025')).toBeInTheDocument();
  });

  it('shows empty rates as not added', async () => {
    useApi(makeItem({ defaultRatePerDay: undefined, damageRate: 0, costPrice: undefined }));
    renderPage();
    const details = await waitFor(() => section('Details'));
    expect(within(details).getAllByRole('button', { name: /Not added/ })).toHaveLength(3);
  });

  it('shows purchase information when present', async () => {
    useApi();
    renderPage();
    const purchase = await waitFor(() => section('Purchase information'));
    expect(within(purchase).getByText('Shree Steel')).toBeInTheDocument();
    expect(within(purchase).getByText('₹850.50')).toHaveClass('mono');
    expect(within(purchase).getByText('20 Oct 2025')).toBeInTheDocument();
    expect(within(purchase).getByText('Partial')).toBeInTheDocument();
  });

  it('hides purchase information when absent', async () => {
    useApi(makeItem({ purchaseInfo: undefined }));
    renderPage();
    await screen.findByRole('heading', { name: 'Cuplock vertical', level: 1 });
    expect(screen.queryByRole('heading', { name: 'Purchase information' })).not.toBeInTheDocument();
  });

  it('shows the description and edits it inline', async () => {
    useApi();
    const bodies = capture('patch', BASE);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Standard 2m vertical/ }));
    const box = within(section('Description')).getByRole('textbox');
    await user.clear(box);
    await user.type(box, 'New text');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bodies).toEqual([{ description: 'New text' }]));
  });

  it('saves a rate edit with Enter and the same payload', async () => {
    useApi();
    const bodies = capture('patch', BASE);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /₹1,250/ }));
    const input = screen.getByRole('spinbutton', { name: 'Daily rate' });
    await user.clear(input);
    await user.type(input, '1500{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ defaultRatePerDay: 1500 }]));
  });

  it('cancels an edit with Escape', async () => {
    useApi();
    const bodies = capture('patch', BASE);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /₹150/ }));
    await user.type(screen.getByRole('spinbutton', { name: 'Damage charge' }), '9{Escape}');
    expect(bodies).toEqual([]);
    expect(screen.getByRole('button', { name: /₹150/ })).toBeVisible();
  });

  it('saves an edited category', async () => {
    useApi();
    const bodies = capture('patch', BASE);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Scaffolding/ }));
    const input = screen.getByPlaceholderText('Select or type a category…');
    await user.clear(input);
    await user.type(input, 'Planks');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bodies).toEqual([{ category: 'Planks' }]));
  });

  it('adjusts stock with the exact payload and resets the form', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/adjust-quantity`);
    const { user } = renderPage();
    const form = await screen.findByRole('form', { name: 'Adjust stock' });

    await user.selectOptions(within(form).getByLabelText(/Type/), 'sold');
    await user.type(within(form).getByLabelText(/Quantity/), '5');
    fireEvent.change(within(form).getByLabelText(/Date/), { target: { value: '2025-11-10' } });
    await user.type(within(form).getByLabelText(/Note/), 'batch #12');
    await user.click(within(form).getByRole('button', { name: 'Update stock' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ type: 'sold', quantity: 5, date: '2025-11-10', note: 'batch #12' }])
    );
    await waitFor(() => expect(within(form).getByLabelText(/Quantity/)).toHaveValue(null));
    expect(within(form).getByLabelText(/Note/)).toHaveValue('');
  });

  it('omits an empty note from the payload', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/adjust-quantity`);
    const { user } = renderPage();
    const form = await screen.findByRole('form', { name: 'Adjust stock' });
    await user.type(within(form).getByLabelText(/Quantity/), '7');
    fireEvent.change(within(form).getByLabelText(/Date/), { target: { value: '2025-11-10' } });
    await user.click(within(form).getByRole('button', { name: 'Update stock' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ type: 'purchase', quantity: 7, date: '2025-11-10' }])
    );
  });

  it('validates quantity and date before sending', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/adjust-quantity`);
    renderPage();
    const form = await screen.findByRole('form', { name: 'Adjust stock' });

    fireEvent.submit(form);
    expect(await screen.findByText('Quantity must be at least 1')).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText(/Quantity/), { target: { value: '3' } });
    fireEvent.change(within(form).getByLabelText(/Date/), { target: { value: '' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Date is required')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('shows the server error from an adjustment in a notice', async () => {
    useApi();
    capture('post', `${BASE}/adjust-quantity`, 400);
    const { user } = renderPage();
    const form = await screen.findByRole('form', { name: 'Adjust stock' });
    await user.type(within(form).getByLabelText(/Quantity/), '5');
    await user.click(within(form).getByRole('button', { name: 'Update stock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reduce below rented');
  });

  it('lists the quantity timeline newest first with mono signed quantities', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Quantity timeline/);

    const table = screen.getByRole('table', { name: 'Quantity timeline' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      '8 Nov 2025',
      '5 Nov 2025',
      '20 Oct 2025',
    ]);
    expect(within(rows[0]).getByText('Scraped')).toBeVisible();
    expect(within(rows[0]).getByText('-2')).toHaveClass('mono');
    expect(within(rows[1]).getByText('Delivery (reserved)')).toBeVisible();
    expect(within(rows[1]).getByText('-30')).toHaveClass('mono');
    expect(within(rows[1]).getByText('(rented)')).not.toHaveClass('mono');
    expect(within(rows[1]).getByText('Site A')).toBeVisible();
    expect(within(rows[2]).getByText('+100')).toHaveClass('mono');
    expect(within(rows[2]).getByText('Purchase')).toBeVisible();
  });

  it('labels returns, reversals and edits', async () => {
    useApi(
      makeItem({
        quantityHistory: [
          { _id: 'a', type: 'challan_return', quantity: 4, date: '2025-11-01T00:00:00.000Z' },
          {
            _id: 'b',
            type: 'challan_delivery_reversed',
            quantity: 3,
            date: '2025-11-02T00:00:00.000Z',
          },
          {
            _id: 'c',
            type: 'challan_return_reversed',
            quantity: 2,
            date: '2025-11-03T00:00:00.000Z',
          },
          { _id: 'd', type: 'challan_item_edit', quantity: 1, date: '2025-11-04T00:00:00.000Z' },
          {
            _id: 'e',
            type: 'challan_loss_edit',
            quantity: 6,
            note: 'loss reversed',
            date: '2025-11-05T00:00:00.000Z',
          },
          { _id: 'f', type: 'damaged', quantity: 1, date: '2025-11-06T00:00:00.000Z' },
          { _id: 'g', type: 'short', quantity: 1, date: '2025-11-07T00:00:00.000Z' },
          { _id: 'h', type: 'sold', quantity: 1, date: '2025-11-08T00:00:00.000Z' },
        ] as Inventory['quantityHistory'],
      })
    );
    const { user } = renderPage();
    await openTab(user, /^Quantity timeline/);
    const table = screen.getByRole('table', { name: 'Quantity timeline' });
    for (const label of [
      'Return',
      'Delivery reversed',
      'Return reversed',
      'Challan item edit',
      'Challan loss edit',
      'Damaged',
      'Short',
      'Sold',
    ]) {
      expect(within(table).getByText(label)).toBeVisible();
    }
    expect(within(table).getByText('+4')).toBeVisible();
    expect(within(table).getAllByText('(returned)', { exact: false })).toHaveLength(2);
    expect(within(table).getByText('+6')).toBeVisible();
    expect(within(table).getAllByText('(rented)', { exact: false })).toHaveLength(1);
  });

  it('shows an empty timeline', async () => {
    useApi(makeItem({ quantityHistory: [] }));
    const { user } = renderPage();
    await openTab(user, /^Quantity timeline/);
    expect(screen.getByText('No quantity adjustments yet')).toBeVisible();
  });

  it('loads the change history for the item', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/inventory/i1'), ({ request }) => {
        historyUrl = request.url;
        return ok([]);
      })
    );
    const { user } = renderPage();
    await openTab(user, /Change history/);
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/inventory/i1'));
  });
});
