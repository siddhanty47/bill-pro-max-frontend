import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PartyStockSection } from './PartyStockSection';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import { challanApi } from '../../api/challanApi';
import { baseApi } from '../../api/baseApi';
import type { PartyStockRow } from '../../types';

const PATH = '/businesses/biz-1/parties/p1/stock';

const row = (over: Partial<PartyStockRow>): PartyStockRow => ({
  itemId: 'i1',
  code: 'CUP',
  name: 'Cuplock 2m',
  unit: 'pcs',
  onSite: 1200,
  damagedLost: 5,
  ...over,
});

const ROWS = [
  row({}),
  row({ itemId: 'i2', code: 'PROP', name: 'Steel prop', onSite: 300, damagedLost: 0 }),
  row({ itemId: 'i3', code: 'PLNK', name: 'Plank', onSite: 0, damagedLost: 7 }),
];

const renderSection = () =>
  renderWithProviders(<PartyStockSection businessId="biz-1" partyId="p1" />, {
    preloadedState: signedIn(),
  });

describe('PartyStockSection', () => {
  it('lists rows, then the totals as a summary line (not a row), and a chart for 3+ rows', async () => {
    server.use(http.get(apiUrl(PATH), () => ok(ROWS)));
    renderSection();
    expect(await screen.findByRole('heading', { name: 'Stock on site' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Stock on site' });
    expect(within(table).getByText('Cuplock 2m')).toBeInTheDocument();
    expect(within(table).getByText('1,200')).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Damaged or lost in the last 12 months' })
    ).toBeInTheDocument();
    // one row per item, no fake total row
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(within(table).queryByText('Total')).not.toBeInTheDocument();
    const total = screen.getByText('Total').parentElement as HTMLElement;
    expect(table.contains(total)).toBe(false);
    expect(total).toHaveClass('total');
    expect(screen.getByText('Total')).not.toHaveClass('mono');
    expect(within(total).getByText('1,500')).toHaveClass('mono');
    expect(within(total).getByText('12')).toHaveClass('mono');
    expect(within(total).getByText(/Damaged or lost in the last 12 months/)).toBeInTheDocument();
    expect(
      await screen.findByRole('region', { name: 'Stock on site, scrollable' })
    ).toBeInTheDocument();
  });

  it('never says "this year" and uses the accent for on site', async () => {
    server.use(http.get(apiUrl(PATH), () => ok(ROWS)));
    const { container } = renderSection();
    await screen.findByRole('region', { name: 'Stock on site, scrollable' });
    expect(container).not.toHaveTextContent(/this year/i);
    // the legend swatch for "On site" matches the dashboard's "At sites"
    const onSite = screen.getAllByText('On site', { selector: 'li' })[0];
    expect(onSite.querySelector('[class*="sw-accent"]')).not.toBeNull();
  });

  it('flags a negative count in the table and draws no bar below zero', async () => {
    server.use(
      http.get(apiUrl(PATH), () =>
        ok([...ROWS, row({ itemId: 'i4', code: 'INR', name: 'Inner 2 mtr', onSite: -18 })])
      )
    );
    renderSection();
    const table = await screen.findByRole('table', { name: 'Stock on site' });
    expect(within(table).getByText('-18').closest('td')).toHaveClass('tone-negative');
    expect(screen.getByRole('status')).toHaveTextContent('Some counts are below zero');
    expect(
      await screen.findByRole('region', { name: 'Stock on site, scrollable' })
    ).toBeInTheDocument();
  });

  it('shows no chart for two rows or fewer', async () => {
    server.use(http.get(apiUrl(PATH), () => ok(ROWS.slice(0, 2))));
    renderSection();
    await screen.findByRole('table', { name: 'Stock on site' });
    expect(screen.queryByRole('region', { name: /scrollable/ })).not.toBeInTheDocument();
  });

  it('says nothing is on site for no rows', async () => {
    renderSection();
    expect(await screen.findByText('Nothing on site')).toBeInTheDocument();
  });

  it('hides the section on 403', async () => {
    server.use(
      http.get(apiUrl(PATH), () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 }))
    );
    renderSection();
    await waitFor(() => expect(screen.queryByText('Loading stock…')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Stock on site' })).not.toBeInTheDocument();
  });

  it('shows other errors inside the section', async () => {
    server.use(
      http.get(apiUrl(PATH), () =>
        HttpResponse.json({ message: 'Boom', error: { message: 'Boom' } }, { status: 500 })
      )
    );
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    expect(screen.getByRole('heading', { name: 'Stock on site' })).toBeInTheDocument();
  });

  it('refetches after a challan mutation', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl(PATH), () => {
        calls += 1;
        return ok(ROWS.slice(0, 1));
      }),
      http.post(apiUrl('/businesses/biz-1/challans'), () => ok({ _id: 'c1' }))
    );
    const { store } = renderSection();
    await screen.findByRole('table', { name: 'Stock on site' });
    expect(calls).toBe(1);
    await act(async () => {
      await store.dispatch(
        challanApi.endpoints.createChallan.initiate({ businessId: 'biz-1', data: {} as never })
      );
    });
    await waitFor(() => expect(calls).toBe(2));
  });

  it('refetches after an agreement change (rate opening balances count as on site)', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl(PATH), () => {
        calls += 1;
        return ok(ROWS.slice(0, 1));
      })
    );
    const { store } = renderSection();
    await screen.findByRole('table', { name: 'Stock on site' });
    expect(calls).toBe(1);
    act(() => {
      store.dispatch(baseApi.util.invalidateTags(['Agreement']));
    });
    await waitFor(() => expect(calls).toBe(2));
  });
});
