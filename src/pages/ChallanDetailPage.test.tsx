import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { ChallanDetailPage } from './ChallanDetailPage';
import { KeyedByParam } from '../components/KeyedByParam';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Challan, Inventory, Party } from '../types';

const BASE = '/businesses/biz-1/challans/c1';

const makeChallan = (over: Partial<Challan> = {}): Challan =>
  ({
    _id: 'c1',
    businessId: 'biz-1',
    challanNumber: 'R-2026-27-0003',
    type: 'return',
    partyId: 'p1',
    agreementId: 'AG-001',
    date: '2025-11-10T00:00:00.000Z',
    items: [
      { itemId: 'i1', itemName: 'Ladder 1.5m', quantity: 10 },
      { itemId: 'i2', itemName: 'Prop 3m', quantity: 5 },
    ],
    damagedItems: [
      {
        itemId: 'i1',
        itemName: 'Ladder 1.5m',
        quantity: 2,
        damageRate: 150,
        note: 'Bent rung',
        lossType: 'damage',
      },
      {
        itemId: 'i2',
        itemName: 'Prop 3m',
        quantity: 1,
        damageRate: 1250.5,
        lossType: 'need_repair',
      },
    ],
    status: 'draft',
    notes: 'Returned in the evening',
    transporterName: 'Shree Transport',
    vehicleNumber: 'MH12AB1234',
    cartageCharge: 1500,
    createdAt: '2025-11-10T08:30:00.000Z',
    updatedAt: '2025-11-10T08:30:00.000Z',
    ...over,
  }) as Challan;

const inventory = [
  {
    _id: 'i1',
    name: 'Ladder 1.5m',
    code: 'LAD',
    unit: 'pcs',
    totalQuantity: 100,
    quantityHistory: [],
    damageRate: 150,
    costPrice: 900,
  },
  {
    _id: 'i3',
    name: 'Clamp',
    code: 'CLP',
    unit: 'pcs',
    totalQuantity: 50,
    quantityHistory: [],
    damageRate: 20,
    costPrice: 80,
  },
] as unknown as Inventory[];

const paged = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    data,
    pagination: { page: 1, pageSize: 100, total: data.length, totalPages: 1 },
  });

function useApi(challan: Challan = makeChallan()) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(challan)),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([{ _id: 'p1', name: 'Mehta Builders' }] as Party[])
    ),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => paged(inventory))
  );
}

/** Captures bodies sent with `method` to `path`; replies with the challan. */
function capture(method: 'patch' | 'post' | 'put' | 'delete', path: string) {
  const bodies: unknown[] = [];
  server.use(
    http[method](apiUrl(path), async ({ request }) => {
      bodies.push(method === 'delete' ? null : await request.json());
      return ok(makeChallan());
    })
  );
  return bodies;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/challans/:challanId" element={<ChallanDetailPage />} />
      <Route path="*" element={<div>elsewhere</div>} />
    </Routes>,
    { preloadedState: signedIn(), route: '/challans/c1' }
  );
}

async function openTab(user: ReturnType<typeof renderPage>['user'], name: RegExp) {
  await user.click(await screen.findByRole('tab', { name }));
}

afterEach(() => vi.restoreAllMocks());

describe('ChallanDetailPage record navigation', () => {
  it('steps through the list it was opened from', async () => {
    useApi();
    renderWithProviders(
      <Routes>
        <Route path="/challans/:challanId" element={<ChallanDetailPage />} />
      </Routes>,
      {
        preloadedState: signedIn(),
        route: '/challans/c1',
        routeState: { recordNav: { paths: ['/challans/c1', '/challans/c2'], index: 0 } },
      }
    );
    expect(await screen.findByRole('button', { name: 'Next challan' })).toBeEnabled();
  });

  it('resets local edit state when stepping to the next record', async () => {
    useApi();
    server.use(http.get(apiUrl('/businesses/biz-1/challans/c2'), () => ok(makeChallan())));
    const { user } = renderWithProviders(
      <Routes>
        <Route
          path="/challans/:challanId"
          element={
            <KeyedByParam param="challanId">
              <ChallanDetailPage />
            </KeyedByParam>
          }
        />
      </Routes>,
      {
        preloadedState: signedIn(),
        route: '/challans/c1',
        routeState: { recordNav: { paths: ['/challans/c1', '/challans/c2'], index: 0 } },
      }
    );
    await openTab(user, /^Items/);
    await user.click(await screen.findByRole('button', { name: 'Edit loss items' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Loss quantity' }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Next challan' }));
    await openTab(user, /^Items/);
    expect(await screen.findByRole('button', { name: 'Edit loss items' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Loss quantity' })).not.toBeInTheDocument();
  });
});

describe('ChallanDetailPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading challan…')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Challan not found' } },
          { status: 404 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText(/Challan not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again|Retry/ })).toBeInTheDocument();
  });

  it('renders the header, tabs with counts, transport and the details sidebar', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'R-2026-27-0003', level: 1 })).toBeVisible();
    expect(screen.queryByText('Return challan')).not.toBeInTheDocument();
    expect(screen.getAllByText('Draft')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Challans' })).toHaveAttribute(
      'href',
      '/challans'
    );
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'About',
      'Items 2',
      'Change history',
    ]);

    const transport = screen.getByRole('heading', { name: 'Transportation' }).closest('section')!;
    expect(within(transport).getByRole('button', { name: /Shree Transport/ })).toBeVisible();
    expect(within(transport).getByRole('button', { name: /MH12AB1234/ })).toHaveClass('mono');
    expect(within(transport).getByRole('button', { name: /₹1,500/ })).toHaveClass('mono');
    expect(within(transport).getAllByRole('button', { name: /Not added/ })).toHaveLength(2);
    expect(screen.getByText('Returned in the evening')).toBeInTheDocument();

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).getByText('Challan number')).toBeInTheDocument();
    expect(within(details).getByText('R-2026-27-0003')).toHaveClass('mono');
    expect(within(details).getByText('Return')).toBeInTheDocument();
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(within(details).getByRole('link', { name: 'AG-001' })).toHaveClass('wrap');
    expect(within(details).getByRole('link', { name: 'AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(within(details).getByRole('button', { name: /10 Nov 2025/ })).toBeVisible();
    expect(within(details).getByText('Confirmed by')).toBeInTheDocument();
    expect(within(details).getByText('10 Nov 2025, 08:30')).toBeInTheDocument();
  });

  it('shows the signature when present', async () => {
    useApi(makeChallan({ signature: 'R. Mehta' }));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Signature' })).toBeInTheDocument();
    expect(screen.getByText('R. Mehta')).toBeInTheDocument();
  });

  it('confirms a draft after the confirmation dialog', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/confirm`);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(confirm).toHaveBeenCalledWith('Confirm challan R-2026-27-0003?');
    await waitFor(() => expect(bodies).toEqual([{ confirmedBy: 'Unknown' }]));
  });

  it('does not confirm when the dialog is declined, and alerts on failure', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/confirm`);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(bodies).toEqual([]);

    confirm.mockReturnValue(true);
    server.use(
      http.post(apiUrl(`${BASE}/confirm`), () =>
        HttpResponse.json({ success: false, error: { message: 'Stock short' } }, { status: 400 })
      )
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Stock short')));
  });

  it('makes Download PDF the primary action once the challan is confirmed', async () => {
    useApi(
      makeChallan({
        status: 'confirmed',
        confirmedBy: 'Asha',
        confirmedAt: '2025-11-11T10:05:00.000Z',
      })
    );
    renderPage();
    expect(await screen.findByRole('button', { name: 'Download PDF' })).toHaveClass('primary');
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Confirmed')).toHaveLength(1);
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('11 Nov 2025, 10:05')).toBeInTheDocument();
  });

  it('downloads the PDF', async () => {
    useApi();
    let pdfRequests = 0;
    server.use(
      http.get(apiUrl(`${BASE}/pdf`), () => {
        pdfRequests += 1;
        return new HttpResponse('%PDF', { headers: { 'Content-Type': 'application/pdf' } });
      })
    );
    const createObjectURL = vi.fn(() => 'blob:challan');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:challan'));
    expect(pdfRequests).toBe(1);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it('alerts when the PDF fails', async () => {
    useApi();
    server.use(
      http.get(apiUrl(`${BASE}/pdf`), () =>
        HttpResponse.json({ success: false, error: { message: 'PDF broke' } }, { status: 500 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.any(String)));
  });

  it('saves transportation and date edits with the same payloads', async () => {
    useApi();
    const transport = capture('patch', `${BASE}/transportation`);
    const dates = capture('patch', `${BASE}/date`);
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: /Shree Transport/ }));
    const name = screen.getByRole('textbox', { name: 'Transporter' });
    await user.clear(name);
    await user.type(name, 'Om Logistics{Enter}');
    await waitFor(() => expect(transport).toHaveLength(1));

    await user.click(await screen.findByRole('button', { name: /MH12AB1234/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Vehicle number' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(transport).toHaveLength(2));

    await user.click(await screen.findByRole('button', { name: /₹1,500/ }));
    const cartage = screen.getByRole('spinbutton', { name: 'Cartage charge' });
    await user.clear(cartage);
    await user.type(cartage, '2500{Enter}');
    await waitFor(() => expect(transport).toHaveLength(3));

    expect(transport).toEqual([{ transporterName: 'Om Logistics' }, {}, { cartageCharge: 2500 }]);

    await user.click(await screen.findByRole('button', { name: /10 Nov 2025/ }));
    const date = screen.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2025-11-12');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(dates).toEqual([{ date: '2025-11-12' }]));
  });

  it('lists items with mono quantities and edits a quantity inline', async () => {
    useApi();
    const bodies = capture('patch', `${BASE}/items/i1`);
    const { user } = renderPage();
    await openTab(user, /^Items/);

    const table = screen.getByRole('table', { name: 'Items' });
    const row = within(table).getByRole('row', { name: /Ladder 1.5m/ });
    const qty = within(row).getByRole('button', { name: /10/ });
    expect(qty.closest('td')).toHaveClass('mono', 'right');
    expect(qty).toHaveClass('right');

    await user.click(qty);
    const input = within(row).getByRole('spinbutton', { name: 'Quantity' });
    await user.clear(input);
    await user.type(input, '12{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ quantity: 12 }]));
  });

  it('asks for a reason before changing a quantity that touches a sent bill', async () => {
    useApi();
    const calls: Array<{ dryRun: boolean; body: unknown }> = [];
    server.use(
      http.patch(apiUrl(`${BASE}/items/i1`), async ({ request }) => {
        const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
        calls.push({ dryRun, body: await request.json() });
        if (dryRun) {
          return ok({
            dryRun: true,
            report: {
              affected: [{ billId: 'b9', billNumber: 'INV-9', status: 'sent', issued: true }],
              negative: [],
              requiresReason: true,
              blocked: null,
            },
          });
        }
        return ok(makeChallan());
      })
    );
    const { user } = renderPage();
    await openTab(user, /^Items/);
    const row = within(screen.getByRole('table', { name: 'Items' })).getByRole('row', {
      name: /Ladder 1.5m/,
    });
    await user.click(within(row).getByRole('button', { name: /10/ }));
    const input = within(row).getByRole('spinbutton', { name: 'Quantity' });
    await user.clear(input);
    await user.type(input, '12{Enter}');

    expect(await screen.findByRole('link', { name: 'INV-9' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reason/), 'Counted again');
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual([
      { dryRun: true, body: { quantity: 12 } },
      { dryRun: false, body: { quantity: 12, reason: 'Counted again' } },
    ]);
  });

  it('cancels a quantity edit with Escape', async () => {
    useApi();
    const bodies = capture('patch', `${BASE}/items/i1`);
    const { user } = renderPage();
    await openTab(user, /^Items/);
    const row = within(screen.getByRole('table', { name: 'Items' })).getByRole('row', {
      name: /Ladder 1.5m/,
    });
    await user.click(within(row).getByRole('button', { name: /10/ }));
    await user.type(within(row).getByRole('spinbutton', { name: 'Quantity' }), '9{Escape}');
    expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('deletes an item only after the confirmation dialog', async () => {
    useApi();
    const calls = capture('delete', `${BASE}/items/i2`);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderPage();
    await openTab(user, /^Items/);

    const row = within(screen.getByRole('table', { name: 'Items' })).getByRole('row', {
      name: /Prop 3m/,
    });
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete this item from the challan?');
    expect(calls).toEqual([]);

    confirm.mockReturnValue(true);
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it('cannot delete the only item', async () => {
    useApi(makeChallan({ items: [{ itemId: 'i1', itemName: 'Ladder 1.5m', quantity: 10 }] }));
    const { user } = renderPage();
    await openTab(user, /^Items/);
    expect(
      within(screen.getByRole('table', { name: 'Items' })).queryByRole('button', {
        name: 'More actions',
      })
    ).not.toBeInTheDocument();
  });

  it('adds an item from the inventory autocomplete', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/items`);
    const { user } = renderPage();
    await openTab(user, /^Items/);
    await screen.findByRole('table', { name: 'Items' });

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(screen.getByRole('combobox'), 'CLP');
    await user.click(await screen.findByText('Clamp'));
    const qty = screen.getByRole('spinbutton', { name: 'Quantity to add' });
    await user.clear(qty);
    await user.type(qty, '4');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(bodies).toEqual([{ itemId: 'i3', itemName: 'Clamp', quantity: 4 }]));
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('closes the add-item row on Cancel', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Items/);
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no items', async () => {
    useApi(makeChallan({ items: [], damagedItems: [] }));
    const { user } = renderPage();
    await openTab(user, /^Items/);
    expect(await screen.findAllByText('No items in this challan')).not.toHaveLength(0);
    expect(screen.getAllByText('No loss items recorded').length).toBeGreaterThan(0);
  });

  it('renders damaged items on returns with type, rate and amount', async () => {
    useApi();
    const { user } = renderPage();
    await openTab(user, /^Items/);

    const table = screen.getByRole('table', { name: 'Loss items' });
    const damaged = within(table).getByRole('row', { name: /Ladder 1.5m/ });
    expect(within(damaged).getByText('Damaged')).toBeInTheDocument();
    expect(within(damaged).getByText('₹150')).toHaveClass('mono');
    expect(within(damaged).getByText('₹300')).toBeInTheDocument();
    expect(within(damaged).getByText('Bent rung')).toBeInTheDocument();
    const repair = within(table).getByRole('row', { name: /Prop 3m/ });
    expect(within(repair).getByText('Need repair')).toBeInTheDocument();
    expect(within(repair).getAllByText('₹1,250.50')).not.toHaveLength(0);
  });

  it('does not show loss items on delivery challans', async () => {
    useApi(makeChallan({ type: 'delivery', damagedItems: undefined }));
    const { user } = renderPage();
    await openTab(user, /^Items/);
    await screen.findByRole('table', { name: 'Items' });
    expect(screen.queryByRole('heading', { name: 'Loss items' })).not.toBeInTheDocument();
  });

  it('edits loss items and saves the same payload', async () => {
    useApi();
    const bodies = capture('put', `${BASE}/damaged-items`);
    const { user } = renderPage();
    await openTab(user, /^Items/);

    await user.click(await screen.findByRole('button', { name: 'Edit loss items' }));
    const qty = screen.getAllByRole('spinbutton', { name: 'Loss quantity' })[0];
    await user.clear(qty);
    await user.type(qty, '3');
    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Loss type' })[0], 'short');
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      damagedItems: [
        {
          itemId: 'i1',
          itemName: 'Ladder 1.5m',
          quantity: 3,
          damageRate: 900,
          note: 'Bent rung',
          lossType: 'short',
        },
      ],
    });
  });

  it('adds a blank loss row and cancels the edit', async () => {
    useApi();
    const bodies = capture('put', `${BASE}/damaged-items`);
    const { user } = renderPage();
    await openTab(user, /^Items/);

    await user.click(await screen.findByRole('button', { name: 'Edit loss items' }));
    await user.click(screen.getByRole('button', { name: 'Add loss item' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Loss quantity' })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit loss items' })).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('loads the change history for the challan', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/challan/c1'), ({ request }) => {
        historyUrl = request.url;
        return paged([]);
      })
    );
    const { user } = renderPage();
    await openTab(user, /Change history/);
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/challan/c1'));
  });

  describe('closed financial year', () => {
    const MESSAGE =
      'FY 2025-26 is closed for this site. Nothing dated on or before 31 Mar 2026 can change.';

    function closedThrough(seen: URLSearchParams[] = []) {
      server.use(
        http.get(apiUrl('/businesses/biz-1/year-close/site'), ({ request }) => {
          seen.push(new URL(request.url).searchParams);
          return ok({
            closedThrough: {
              fy: '2025-26',
              date: '2026-03-31T00:00:00.000Z',
              lockedThrough: '2026-03-31T00:00:00.000Z',
            },
          });
        })
      );
      return seen;
    }

    it('locks every change on a challan dated 31 Mar of the closed year', async () => {
      useApi(makeChallan({ date: '2026-03-31T00:00:00.000Z' }));
      const seen = closedThrough();
      const { user } = renderPage();

      expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
      expect(seen[0].get('partyId')).toBe('p1');
      expect(seen[0].get('agreementId')).toBe('AG-001');
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
      const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
      expect(within(details).queryByRole('button', { name: /31 Mar/ })).not.toBeInTheDocument();
      expect(within(details).getByText(/31 Mar/)).toBeInTheDocument();
      const transport = screen.getByRole('heading', { name: 'Transportation' }).closest('section')!;
      expect(within(transport).queryByRole('button')).not.toBeInTheDocument();

      await openTab(user, /Items/);
      const items = screen.getByRole('table', { name: 'Items' });
      expect(within(items).queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Edit loss items' })).toBeDisabled();
    });

    it('leaves a challan dated 1 Apr editable', async () => {
      useApi(makeChallan({ date: '2026-04-01T00:00:00.000Z' }));
      const seen = closedThrough();
      renderPage();

      const details = (await screen.findByRole('heading', { name: 'Details' })).closest('section')!;
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(within(details).getByRole('button', { name: /1 Apr/ })).toBeVisible();
      expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('does not flash the lock while the closed year is loading', async () => {
      useApi(makeChallan({ date: '2026-03-31T00:00:00.000Z' }));
      server.use(
        http.get(apiUrl('/businesses/biz-1/year-close/site'), () => new Promise<never>(() => {}))
      );
      renderPage();

      const details = (await screen.findByRole('heading', { name: 'Details' })).closest('section')!;
      expect(within(details).getByRole('button', { name: /31 Mar/ })).toBeVisible();
      expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });
  });
});
