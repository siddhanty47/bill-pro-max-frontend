import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Bill, Business, Party } from '../types';

const business = { _id: 'biz-1', name: 'Patel Scaffold Co.' } as Business;

const party = (over: Partial<Party>) =>
  ({ _id: 'p1', name: 'Mehta Builders', isActive: true, ...over }) as Party;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const bill = (over: Partial<Bill>) =>
  ({
    _id: 'b1',
    billNumber: 'BL-0247',
    partyId: 'p1',
    status: 'sent',
    totalAmount: 184200,
    amountPaid: 0,
    dueDate: daysAgo(19),
    ...over,
  }) as Bill;

const stats = {
  totalItems: 42,
  totalQuantity: 14820,
  availableQuantity: 5632,
  rentedQuantity: 9188,
  categories: [],
};

function useApi({
  businesses = [business],
  parties = [party({}), party({ _id: 'p2', name: 'Old Co', isActive: false })],
  bills = [
    bill({}),
    bill({
      _id: 'b2',
      billNumber: 'BL-0251',
      status: 'partial',
      totalAmount: 100000,
      amountPaid: 40000,
    }),
    bill({ _id: 'b3', billNumber: 'BL-0300', status: 'paid', totalAmount: 5000, amountPaid: 5000 }),
  ],
  overdue = [bill({})],
}: {
  businesses?: Business[];
  parties?: Party[];
  bills?: Bill[];
  overdue?: Bill[];
} = {}) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok(businesses)),
    http.get(apiUrl('/businesses/biz-1/inventory/stats'), () => ok(stats)),
    http.get(apiUrl('/businesses/biz-1/parties'), () => ok(parties)),
    http.get(apiUrl('/businesses/biz-1/bills/overdue'), () => ok(overdue)),
    http.get(apiUrl('/businesses/biz-1/bills'), () =>
      HttpResponse.json({ success: true, data: bills })
    )
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage(state = signedIn()) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: state }
  );
}

afterEach(() => vi.restoreAllMocks());

describe('DashboardPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
  });

  it('titles the page with the current business name, without a welcome line', async () => {
    useApi();
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patel Scaffold Co.' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome to/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add business/ })).toBeInTheDocument();
    // outstanding = 184200 + 60000 + 0 + 0
    expect(screen.getByText('₹2,44,200')).toBeInTheDocument();
    expect(screen.getByText('Stock · 14,820 pcs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    const parties = screen.getByText('Active parties').parentElement as HTMLElement;
    expect(within(parties).getByText('1')).toBeInTheDocument();
    const pending = screen.getByText('Pending bills').parentElement as HTMLElement;
    expect(within(pending).getByText('2')).toBeInTheDocument();
  });

  it('describes stock split in the meter', async () => {
    useApi();
    renderPage();
    expect(
      await screen.findByRole('img', {
        name: /Available 5,632 of 14,820, Rented out 9,188 of 14,820/,
      })
    ).toBeInTheDocument();
  });

  it('lists overdue bills with party, days and links to the bill', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'BL-0247' })).toHaveAttribute(
      'href',
      '/bills/b1'
    );
    expect(within(table).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(table).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(table).getByText('19 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All bills/ })).toHaveAttribute('href', '/bills');
  });

  it('counts an overdue bill under 24h as 1 day', async () => {
    useApi({ overdue: [bill({ dueDate: daysAgo(0.25) })] });
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('1 day')).toBeInTheDocument();
  });

  it('shows at most 5 overdue rows and hides the party column when no party is found', async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      bill({ _id: `o${i}`, billNumber: `OV-${i}`, partyId: 'ghost' })
    );
    useApi({ overdue: many });
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6); // header + 5
    expect(within(table).queryByRole('columnheader', { name: 'Party' })).not.toBeInTheDocument();
  });

  it('omits the overdue card when nothing is overdue', async () => {
    useApi({ overdue: [] });
    renderPage();
    await screen.findByText('Active parties');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue bills')).not.toBeInTheDocument();
  });

  it('opens the business modal from Add business and alerts on success', async () => {
    useApi();
    server.use(http.post(apiUrl('/businesses'), () => ok(business)));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Add business/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Business name/), 'New Co');
    await user.click(within(dialog).getByRole('button', { name: /create|save/i }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Business created successfully')
      )
    );
  });

  it('alerts with the error message when creation fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl('/businesses'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Add business/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Business name/), 'New Co');
    await user.click(within(dialog).getByRole('button', { name: /create|save/i }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('successfully'));
  });

  it('with no businesses, shows an empty state that opens the create modal', async () => {
    useApi({ businesses: [] });
    const { user } = renderPage(signedIn(''));
    expect(await screen.findByText('No businesses yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create business/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
