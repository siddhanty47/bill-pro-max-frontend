import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { YearClosePage } from './YearClosePage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { YearStatusRow } from '../types';

const closed: YearStatusRow = {
  partyId: 'p1',
  partyName: 'Mehta Builders',
  partyCode: 'MEH',
  siteCode: 'S1',
  siteAddress: 'Plot 12, Andheri',
  lastBillableDay: '2026-03-31T00:00:00.000Z',
  closed: true,
  closingBillId: 'b1',
  closingBillNumber: 'INV-2025-26-0042',
};

const open: YearStatusRow = {
  partyId: 'p2',
  partyName: 'Gupta Infra',
  partyCode: 'GUP',
  siteCode: 'S2',
  siteAddress: 'Tower B, Powai',
  lastBillableDay: '2025-12-31T00:00:00.000Z',
  closed: false,
};

/** Serves rows per `fy` and records each requested FY. */
function useApi(byFy: Record<string, YearStatusRow[]>) {
  const requested: string[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/year-close'), ({ request }) => {
      const fy = new URL(request.url).searchParams.get('fy') ?? '';
      requested.push(fy);
      return ok(byFy[fy] ?? []);
    })
  );
  return requested;
}

const renderPage = () =>
  renderWithProviders(<YearClosePage />, { preloadedState: signedIn(), route: '/year-close' });

const table = () => screen.getByRole('table', { name: 'Year status' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T06:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('YearClosePage', () => {
  it('defaults to the last ended FY and lists closed and open sites', async () => {
    const requested = useApi({ '2025-26': [closed, open] });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Year close', level: 1 })).toBeVisible();
    expect(
      screen.getByText(
        'A year closes for a site once its bill ending on the last billable day is issued. After that nothing dated in that year can change.'
      )
    ).toBeVisible();
    const select = screen.getByRole('combobox', { name: 'Financial year' });
    expect(select).toHaveValue('2025-26');
    expect(
      within(select)
        .getAllByRole('option')
        .map(o => o.textContent)
    ).toEqual(['FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24', 'FY 2022-23', 'FY 2021-22']);

    await screen.findByRole('table', { name: 'Year status' });
    expect(requested).toEqual(['2025-26']);

    const closedRow = within(table()).getByText('Mehta Builders').closest('tr')!;
    expect(within(closedRow).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(within(closedRow).getByText('S1')).toHaveClass('mono');
    expect(within(closedRow).getByText('Plot 12, Andheri')).toBeVisible();
    expect(within(closedRow).getByText('31 Mar 2026')).toBeVisible();
    expect(within(closedRow).getByText('Closed')).toBeVisible();
    expect(within(closedRow).getByRole('link', { name: 'INV-2025-26-0042' })).toHaveAttribute(
      'href',
      '/bills/b1'
    );

    const openRow = within(table()).getByText('Gupta Infra').closest('tr')!;
    expect(within(openRow).getByText('Open')).toBeVisible();
    expect(within(openRow).getByText('31 Dec 2025')).toBeVisible();
    expect(
      within(openRow).getByText('Issue the bill ending 31 Dec 2025 to close the year')
    ).toBeVisible();
    expect(within(openRow).queryByRole('link', { name: /INV/ })).not.toBeInTheDocument();
  });

  it('switches FY and shows the current FY as running', async () => {
    const requested = useApi({
      '2025-26': [closed],
      '2026-27': [{ ...open, lastBillableDay: '2027-03-31T00:00:00.000Z' }],
    });
    const { user } = renderPage();
    await screen.findByText('Mehta Builders', { selector: 'table a' });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial year' }), '2026-27');

    await waitFor(() =>
      expect(within(table()).getByText('Gupta Infra').closest('tr')!).toHaveTextContent('Running')
    );
    expect(requested).toEqual(['2025-26', '2026-27']);
    const row = within(table()).getByText('Gupta Infra').closest('tr')!;
    expect(within(row).queryByText('Open')).not.toBeInTheDocument();
    expect(within(row).queryByText(/Issue the bill ending/)).not.toBeInTheDocument();
  });

  it('shows a missing last billable day as not added', async () => {
    useApi({ '2025-26': [{ ...open, lastBillableDay: null }] });
    renderPage();
    const row = (await screen.findByText('Gupta Infra', { selector: 'table a' })).closest('tr')!;
    expect(within(row).getAllByText('Not added').length).toBeGreaterThanOrEqual(1);
    expect(within(row).queryByText(/Issue the bill ending/)).not.toBeInTheDocument();
  });

  it('lists each site on phones with its status and closing bill', async () => {
    useApi({ '2025-26': [closed, open] });
    renderPage();
    const list = await screen.findByRole('list', { name: 'Year status' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Mehta Builders');
    expect(first).toHaveTextContent('Closed');
    expect(first).toHaveTextContent('S1');
    expect(within(first).getByText('INV-2025-26-0042')).toBeInTheDocument();
    expect(second).toHaveTextContent('Open');
    expect(second).toHaveTextContent('Issue the bill ending 31 Dec 2025 to close the year');
  });

  it('shows an empty state for an FY with no sites', async () => {
    useApi({});
    renderPage();
    expect(await screen.findAllByText('No sites were billable in FY 2025-26')).not.toHaveLength(0);
  });

  it('shows the error with a retry', async () => {
    useApi({});
    server.use(
      http.get(apiUrl('/businesses/biz-1/year-close'), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Year status failed' } },
          { status: 500 }
        )
      )
    );
    renderPage();
    expect(await screen.findByText(/Year status failed/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Retry|Try again/ })).toBeVisible();
  });
});
