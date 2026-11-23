import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PartyStockSection } from './PartyStockSection';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import { challanApi } from '../../api/challanApi';
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
  it('lists rows with a total, and a chart for more than two rows', async () => {
    server.use(http.get(apiUrl(PATH), () => ok(ROWS)));
    renderSection();
    expect(await screen.findByRole('heading', { name: 'Stock on site' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Stock on site' });
    expect(within(table).getByText('Cuplock 2m')).toBeInTheDocument();
    expect(within(table).getByText('1,200')).toBeInTheDocument();
    const total = within(table).getByText('Total').closest('tr')!;
    expect(within(total).getByText('1,500')).toBeInTheDocument();
    expect(within(total).getByText('12')).toBeInTheDocument();
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
});
