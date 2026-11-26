import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PaymentsPage } from './PaymentsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import * as download from '../utils/download';
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
    .map(r => within(r).getAllByRole('cell')[6].textContent);

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
    // Money in green, money out red, net by its sign.
    expect(screen.getByText('Total received').nextElementSibling).toHaveClass('tone-positive');
    expect(screen.getByText('Total paid').nextElementSibling).toHaveClass('tone-negative');
    expect(screen.getByText('Net').nextElementSibling).toHaveClass('tone-positive');
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

  it('shows an empty state whose action opens the record payment modal', async () => {
    useApi([]);
    const { user } = renderPage();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Record payment/ })[1]);
    expect(await screen.findByRole('dialog', { name: 'Record payment' })).toBeInTheDocument();
  });

  it('renders the phone list with amount, party, type, date and method', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const list = screen.getByRole('list', { name: 'Payments' });
    const item = within(list).getAllByRole('listitem')[1];
    expect(within(item).getByText('₹99.50')).toBeInTheDocument();
    expect(within(item).getByText('Om Constructions')).toBeInTheDocument();
    expect(item).toHaveTextContent(/Paid.*4 May 2020.*Cash/);
    expect(within(item).getByText('Completed')).toBeInTheDocument();
    const withRef = within(list).getAllByRole('listitem')[0];
    expect(within(withRef).getByText('UTR123')).toHaveClass('mono');
  });

  it('shows an error and retries', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.get(apiUrl('/businesses/biz-1/payments'), () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
          : ok(defaults);
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('shows a filtered-empty state', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search payments' }), 'zzz');
    expect(screen.getByText('No payments match these filters')).toBeInTheDocument();
  });

  describe('bulk export', () => {
    afterEach(() => vi.restoreAllMocks());
    const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });
    const selectAll = (user: ReturnType<typeof renderPage>['user']) =>
      user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    const saved = () => {
      const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
      return async () => {
        const [blob, name] = save.mock.calls[0];
        return { name, text: await (blob as Blob).text() };
      };
    };

    it('exports the selected payments with the table columns, amounts as numbers', async () => {
      useApi();
      const read = saved();
      const { user } = renderPage();
      await screen.findByRole('table');
      expect(bar()).not.toBeInTheDocument();
      await selectAll(user);
      expect(bar()).toHaveTextContent('3 payments selected');
      expect(within(bar()!).queryByRole('button', { name: /Delete/ })).toBeNull();
      await user.click(within(bar()!).getByRole('button', { name: 'Export 3 to CSV' }));
      const { name, text } = await read();
      expect(name).toMatch(/^payments-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(text.split('\r\n')).toEqual([
        'Date,Type,Party,Amount,Method,Reference,Status',
        '2020-05-04,Received,Mehta Builders,184200,Bank transfer,UTR123,Completed',
        '2020-05-04,Paid,Om Constructions,99.5,Cash,,Completed',
        '2020-05-04,Received,Mehta Builders,1000,UPI,REF-9,Pending',
      ]);
    });

    it('exports only the ticked rows and names checkboxes by amount and date', async () => {
      useApi();
      const read = saved();
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(
        within(screen.getByRole('table')).getByRole('checkbox', {
          name: 'Select payment of ₹99.50 on 4 May 2020',
        })
      );
      expect(bar()).toHaveTextContent('1 payment selected');
      await user.click(within(bar()!).getByRole('button', { name: 'Export 1 to CSV' }));
      const { text } = await read();
      expect(text.split('\r\n')).toHaveLength(2);
      expect(text).toContain('Om Constructions,99.5');
    });

    const thirty = Array.from({ length: 30 }, (_, i) =>
      payment({ _id: `m${i}`, reference: `R-${i + 1}` })
    );

    it('select-all covers only the 25 payments on the page; a page change clears it', async () => {
      useApi(thirty);
      const { user } = renderPage();
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
      expect(bar()).toHaveTextContent('25 payments selected');
      const nav = screen.getByRole('navigation', { name: 'Payments pages' });
      await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
      expect(bar()).not.toBeInTheDocument();
      expect(rowRefs()).toEqual(['R-26', 'R-27', 'R-28', 'R-29', 'R-30']);
    });

    it('opens a payment from page 2', async () => {
      useApi(thirty);
      const { user } = renderPage();
      await screen.findByRole('table');
      const nav = screen.getByRole('navigation', { name: 'Payments pages' });
      await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
      await user.click(within(screen.getByRole('table')).getByText('R-27'));
      expect(screen.getByTestId('where')).toHaveTextContent('/payments/m26');
    });

    it('clears the selection when a filter changes', async () => {
      useApi();
      const { user } = renderPage();
      await screen.findByRole('table');
      await selectAll(user);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'payable');
      await waitFor(() => expect(bar()).not.toBeInTheDocument());
    });
  });
});
