import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AgreementsPage } from './AgreementsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { AgreementWithParty } from '../types';

const agreement = (over: Partial<AgreementWithParty>) =>
  ({
    agreementId: 'AGR-001',
    siteCode: 'S1',
    partyId: 'p1',
    partyName: 'Mehta Builders',
    startDate: '2020-04-01T00:00:00.000Z',
    endDate: '2020-12-31T00:00:00.000Z',
    status: 'active',
    terms: { billingCycle: 'monthly', paymentDueDays: 15 },
    rates: [{}, {}, {}],
    ...over,
  }) as unknown as AgreementWithParty;

const defaults = [
  agreement({}),
  agreement({
    agreementId: 'AGR-002',
    siteCode: 'TOWER',
    partyName: 'Om Constructions',
    status: 'expired',
    endDate: undefined,
  }),
];

function useApi(rows: AgreementWithParty[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/agreements'), () => ok(rows))
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<AgreementsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn() }
  );
}

const rowIds = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0].textContent);

describe('AgreementsPage', () => {
  it('shows a spinner while loading', () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading agreements…')).toBeInTheDocument();
  });

  it('lists agreements with dates, terms and status', async () => {
    useApi();
    renderPage();
    const table = await screen.findByRole('table');
    expect(rowIds()).toEqual(['AGR-001', 'AGR-002']);
    const row = within(table).getByRole('row', { name: /AGR-001/ });
    expect(within(row).getByText('Mehta Builders')).toBeInTheDocument();
    expect(within(row).getByText('1 Apr 2020')).toBeInTheDocument();
    expect(within(row).getByText('31 Dec 2020')).toBeInTheDocument();
    expect(within(row).getByText('Monthly')).toBeInTheDocument();
    expect(within(row).getByText('15 days')).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    const open = within(table).getByRole('row', { name: /AGR-002/ });
    expect(within(open).getByText('Expired')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'expired');
    expect(rowIds()).toEqual(['AGR-002']);
  });

  it('searches by party, agreement id and site code', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox', { name: 'Search agreements' });
    await user.type(search, 'om cons');
    expect(rowIds()).toEqual(['AGR-002']);
    await user.clear(search);
    await user.type(search, 'agr-001');
    expect(rowIds()).toEqual(['AGR-001']);
    await user.clear(search);
    await user.type(search, 'tower');
    expect(rowIds()).toEqual(['AGR-002']);
  });

  it('focuses the search box on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search agreements' })).toHaveFocus();
  });

  it('navigates to the agreement on row click', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Om Constructions'));
    expect(screen.getByTestId('where')).toHaveTextContent('/agreements/AGR-002');
  });

  it('shows empty and filtered-empty states', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findByText('No agreements yet')).toBeInTheDocument();
  });

  it('shows a filtered-empty state', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search agreements' }), 'zzz');
    expect(screen.getByText('No agreements match these filters')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    server.use(
      http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
      http.get(apiUrl('/businesses/biz-1/agreements'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      )
    );
    renderPage();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
