import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PaymentsPage } from './PaymentsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Party, Payment } from '../types';

const payment = (over: Partial<Payment>) =>
  ({
    _id: 'pay1',
    type: 'receivable',
    partyId: 'p1',
    amount: 184200,
    method: 'bank_transfer',
    reference: 'UTR123',
    date: '2020-05-04T00:00:00.000Z',
    status: 'completed',
    ...over,
  }) as unknown as Payment;

const defaults = [
  payment({}),
  payment({
    _id: 'pay2',
    type: 'payable',
    partyId: 'p2',
    amount: 99.5,
    method: 'cash',
    reference: undefined,
  }),
  payment({ _id: 'pay3', method: 'upi', reference: 'REF-9', status: 'pending', amount: 1000 }),
];

function useApi(rows: Payment[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/payments'), () => ok(rows)),
    http.get(apiUrl('/businesses/biz-1/bills'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([
        {
          _id: 'p1',
          name: 'Mehta Builders',
          isActive: true,
          roles: ['client'],
          agreements: [],
          sites: [],
        },
        {
          _id: 'p2',
          name: 'Om Constructions',
          isActive: true,
          roles: ['client'],
          agreements: [],
          sites: [],
        },
      ] as unknown as Party[])
    )
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PaymentsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn() }
  );
}

const rowRefs = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[5].textContent);

describe('PaymentsPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading payments…')).toBeInTheDocument();
  });

  it('lists payments with formatted fields', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(rowRefs()).toEqual(['UTR123', '—', 'REF-9']);
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getByText('4 May 2020')).toBeInTheDocument();
    expect(within(row).getByText('Received')).toBeInTheDocument();
    expect(within(row).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(row).getByText('₹1,84,200')).toBeInTheDocument();
    expect(within(row).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(within(table).getAllByRole('row')[2]).getByText('₹99.50')).toBeInTheDocument();
    expect(within(within(table).getAllByRole('row')[2]).getByText('Paid')).toBeInTheDocument();
  });

  it('shows totals of completed payments', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    expect(screen.getByText('Total received').nextElementSibling).toHaveTextContent('₹1,84,200');
    expect(screen.getByText('Total paid').nextElementSibling).toHaveTextContent('₹99.50');
    expect(screen.getByText('Net').nextElementSibling).toHaveTextContent('₹1,84,100.50');
  });

  it('filters by type and method', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'payable');
    expect(rowRefs()).toEqual(['—']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Method' }), 'upi');
    expect(rowRefs()).toEqual(['REF-9']);
  });

  it('searches by party and reference', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search payments' });
    await user.type(search, 'om cons');
    expect(rowRefs()).toEqual(['—']);
    await user.clear(search);
    await user.type(search, 'ref-9');
    expect(rowRefs()).toEqual(['REF-9']);
  });

  it('focuses search on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search payments' })).toHaveFocus();
  });

  it('navigates to the payment on row click', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('REF-9'));
    expect(screen.getByTestId('where')).toHaveTextContent('/payments/pay3');
  });

  it('opens the record payment modal', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Record payment/ }));
    expect(await screen.findByRole('dialog', { name: 'Record payment' })).toBeInTheDocument();
  });

  it('shows empty and filtered-empty states', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('shows a filtered-empty state', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search payments' }), 'zzz');
    expect(screen.getByText('No payments match these filters')).toBeInTheDocument();
  });
});
