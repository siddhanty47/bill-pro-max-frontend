import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { readCss } from '../test/readCss';
import type {
  Bill,
  Business,
  DashboardMetric,
  DashboardSummary,
  Party,
  SeriesPoint,
  SeriesResponse,
} from '../types';

// Recharts needs layout jsdom lacks: stand in a plain list of the values each chart gets.
vi.mock('../components/charts/BarLineChart', () => ({
  default: ({
    data,
    format,
    tooltipFormat,
    ariaLabel,
  }: {
    data: SeriesPoint[];
    format: (n: number) => string;
    tooltipFormat?: (n: number) => string;
    ariaLabel: string;
  }) => (
    <div data-testid="billing-chart" role="img" aria-label={ariaLabel}>
      {data
        .map(p => `${format(Number(p.billed))}|${tooltipFormat?.(Number(p.collected))}`)
        .join(',')}
    </div>
  ),
}));
vi.mock('../components/charts/LineChart', () => ({
  default: ({
    data,
    y,
    format,
    ariaLabel,
  }: {
    data: SeriesPoint[];
    y: { key: string };
    format: (n: number) => string;
    ariaLabel: string;
  }) => (
    <div data-testid={`line-${y.key}`} role="img" aria-label={ariaLabel}>
      {data.map(p => format(Number(p[y.key]))).join(',')}
    </div>
  ),
}));

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

const fullSummary: DashboardSummary = {
  billedThisMonth: { value: 420000, previous: 375000 },
  collectedThisMonth: { value: 300000, previous: 312500 },
  avgDaysToPay: 18.4,
  aging: {
    buckets: [
      { key: '0-30', amount: 120000 },
      { key: '31-60', amount: 60000 },
      { key: '61-90', amount: 30000 },
      { key: '90+', amount: 90000 },
    ],
    total: 300000,
    advances: 12000,
  },
  stock: [
    { itemId: 'i1', name: 'Props 3m', unit: 'pcs', atSites: 248, inYard: 152, damagedLost: 18 },
    { itemId: 'i2', name: 'Plates', unit: 'pcs', atSites: 100, inYard: 50, damagedLost: 0 },
  ],
  onRentPct: 63.6,
  activeSites: 7,
  rentPerDay: 12500,
  parties: [
    { partyId: 'p1', name: 'Mehta Builders', outstanding: 184200, onSite: 320, damagedLost: 4 },
  ],
};

const emptySummary: DashboardSummary = {
  billedThisMonth: { value: 0, previous: 0 },
  collectedThisMonth: { value: 0, previous: 0 },
  avgDaysToPay: null,
  aging: {
    buckets: [
      { key: '0-30', amount: 0 },
      { key: '31-60', amount: 0 },
      { key: '61-90', amount: 0 },
      { key: '90+', amount: 0 },
    ],
    total: 0,
    advances: 0,
  },
  stock: [],
  onRentPct: 0,
  activeSites: 0,
  rentPerDay: 0,
  parties: [],
};

const fullSeries: Record<DashboardMetric, Partial<SeriesResponse>> = {
  billing: {
    bucket: 'month',
    points: [
      { t: '2026-10-01', billed: 1840000, collected: 1600000 },
      { t: '2026-11-01', billed: 2000000, collected: 1790000 },
    ],
  },
  utilization: {
    bucket: 'week',
    points: [
      // before any stock: left out of the average
      { t: '2026-11-02', pct: 0, atSites: 0, total: 0 },
      { t: '2026-11-09', pct: 50, atSites: 50, total: 100 },
      { t: '2026-11-16', pct: 130, atSites: 130, total: 100 },
    ],
  },
  steel: {
    bucket: 'month',
    points: [
      { t: '2025-11-01', index: 100, provisional: false },
      { t: '2026-10-01', index: 106, provisional: true },
    ],
    changePct: 6,
  },
};

type SeriesReply = (metric: DashboardMetric, range: string) => Response | undefined;

function useApi({
  businesses = [business],
  parties = [party({}), party({ _id: 'p2', name: 'Old Co', isActive: false })],
  overdue = [bill({})],
  summary = fullSummary,
  series,
}: {
  businesses?: Business[];
  parties?: Party[];
  overdue?: Bill[];
  summary?: DashboardSummary;
  series?: SeriesReply;
} = {}) {
  const requests: string[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok(businesses)),
    http.get(apiUrl('/businesses/biz-1/parties'), () => ok(parties)),
    http.get(apiUrl('/businesses/biz-1/bills/overdue'), () => ok(overdue)),
    http.get(apiUrl('/businesses/biz-1/dashboard/summary'), () => ok(summary)),
    http.get(apiUrl('/businesses/biz-1/dashboard/series'), ({ request }) => {
      const q = new URL(request.url).searchParams;
      const metric = q.get('metric') as DashboardMetric;
      const range = q.get('range') ?? '';
      requests.push(`${metric}:${range}`);
      const custom = series?.(metric, range);
      if (custom) return custom;
      return ok({ metric, range, bucket: 'month', points: [], ...fullSeries[metric] });
    })
  );
  return requests;
}

const emptySeries: SeriesReply = (metric, range) =>
  ok({
    metric,
    range,
    bucket: 'month',
    points: metric === 'utilization' ? [{ t: '2026-11-01', pct: 0, atSites: 0, total: 0 }] : [],
    changePct: null,
  });

function Where() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div data-testid="where">{pathname}</div>
      <div data-testid="state">{JSON.stringify(state)}</div>
    </>
  );
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

beforeEach(() => localStorage.clear());
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
  });

  it('orders the tiles money first, then the stock pair, then days to pay (no orphan on a phone)', async () => {
    useApi();
    renderPage();
    const first = await screen.findByText('Billed this month');
    const grid = first.closest('.tiles') as HTMLElement;
    const labels = [...grid.children].map(t => t.querySelector('.label')?.textContent);
    expect(labels).toEqual([
      'Billed this month',
      'Collected this month',
      'Rent per day',
      'Stock on rent',
      'Active sites',
      'Avg days to get paid',
    ]);
    const pair = [...grid.children].filter(t => t.classList.contains('pairTile'));
    expect(pair.map(t => t.querySelector('.label')?.textContent)).toEqual([
      'Stock on rent',
      'Active sites',
    ]);
    // phone: a wrapping row; every tile full width except the pair, which grows to fill
    // the row when its partner is hidden by permissions
    const css = await readCss('src/pages/dashboard/Dashboard.module.css');
    const phone = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(phone).toMatch(/\.tiles \{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
    expect(phone).toMatch(/\.tiles > \* \{[^}]*flex: 1 1 100%;/);
    expect(phone).toMatch(
      /\.tiles > \.pairTile \{[^}]*flex-basis: calc\(\(100% - var\(--space-3\)\) \/ 2\);/
    );
  });

  it('shows six KPI tiles with values and month-on-month trends', async () => {
    useApi();
    renderPage();
    const tile = async (label: string) =>
      (await screen.findByText(label)).parentElement as HTMLElement;
    const billed = await tile('Billed this month');
    expect(within(billed).getByText('₹4,20,000')).toBeInTheDocument();
    const billedNote = within(billed)
      .getByText(/12% vs last month/)
      .closest('.note');
    expect(billedNote).toHaveTextContent('▲ up 12% vs last month');
    expect(billedNote).toHaveClass('tone-positive');
    expect(within(billed).getByText('▲', { exact: false })).toHaveAttribute('aria-hidden', 'true');
    const collected = await tile('Collected this month');
    expect(within(collected).getByText('₹3,00,000')).toBeInTheDocument();
    const collectedNote = within(collected)
      .getByText(/4% vs last month/)
      .closest('.note');
    expect(collectedNote).toHaveTextContent('▼ down 4% vs last month');
    expect(collectedNote).toHaveClass('tone-negative');
    expect(within(await tile('Avg days to get paid')).getByText('18')).toBeInTheDocument();
    expect(within(await tile('Stock on rent')).getByText('64%')).toBeInTheDocument();
    expect(within(await tile('Active sites')).getByText('7')).toBeInTheDocument();
    expect(within(await tile('Rent per day')).getByText('₹12,500')).toBeInTheDocument();
  });

  it('shows the three charts with range presets and range headlines', async () => {
    const requests = useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Billed vs collected' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stock on rent %' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Steel price index' })).toBeInTheDocument();
    expect(screen.getByText('Govt WPI · mild steel bars & rods · monthly')).toBeInTheDocument();
    expect(await screen.findByText('₹38.4L billed · ₹33.9L collected (88%)')).toBeInTheDocument();
    expect(await screen.findByText('avg 75% on rent')).toBeInTheDocument();
    expect(await screen.findByText(/6\.0% over 1Y/)).toHaveTextContent('▲ up 6.0% over 1Y');
    // each chart is one image named by its title and headline (plain text, "up" not ▲)
    expect(
      await screen.findByRole('img', {
        name: 'Billed vs collected: ₹38.4L billed · ₹33.9L collected (88%)',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Stock on rent %: avg 75% on rent' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Steel price index: up 6.0% over 1Y' })
    ).toBeInTheDocument();
    const groups = screen.getAllByRole('radiogroup', { name: 'Chart range' });
    expect(groups).toHaveLength(3);
    expect(within(groups[0]).getByRole('radio', { name: '1Y' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(within(groups[1]).getByRole('radio', { name: '6M' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(within(groups[1]).getAllByRole('radio')).toHaveLength(6);
    expect(
      within(groups[2])
        .getAllByRole('radio')
        .map(r => r.textContent)
    ).toEqual(['1Y', '3Y', 'All']);
    // axes compact, tooltips full; utilization clamped to 0–100
    expect(await screen.findByTestId('billing-chart')).toHaveTextContent(
      '₹18.4L|₹16,00,000,₹20L|₹17,90,000'
    );
    expect(await screen.findByTestId('line-pct')).toHaveTextContent('0%,50%,100%');
    expect(await screen.findByTestId('line-index')).toHaveTextContent('100,106');
    expect(requests).toEqual(expect.arrayContaining(['billing:1Y', 'utilization:6M', 'steel:1Y']));
  });

  it('requests the new range when a preset is picked', async () => {
    const requests = useApi();
    const { user } = renderPage();
    const groups = await screen.findAllByRole('radiogroup', { name: 'Chart range' });
    await user.click(within(groups[0]).getByRole('radio', { name: '3M' }));
    await waitFor(() => expect(requests).toContain('billing:3M'));
    await user.click(within(groups[2]).getByRole('radio', { name: 'All' }));
    expect(await screen.findByText(/6\.0% over all time/)).toHaveTextContent(
      '▲ up 6.0% over all time'
    );
  });

  it('shows a falling steel index and no headline without a change', async () => {
    let change: number | null = -2.14;
    useApi({
      series: (metric, range) =>
        metric === 'steel'
          ? ok({ ...fullSeries.steel, metric, range, changePct: change })
          : undefined,
    });
    const { user } = renderPage();
    const groups = await screen.findAllByRole('radiogroup', { name: 'Chart range' });
    await user.click(within(groups[2]).getByRole('radio', { name: '3Y' }));
    expect(await screen.findByText(/2\.1% over 3Y/)).toHaveTextContent('▼ down 2.1% over 3Y');
    expect(
      screen.getByRole('img', { name: 'Steel price index: down 2.1% over 3Y' })
    ).toBeInTheDocument();
    change = null;
    await user.click(within(groups[2]).getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(screen.queryByText(/over/)).not.toBeInTheDocument());
  });

  it('shows a flat steel index as a neutral change with no arrow', async () => {
    useApi({
      series: (metric, range) =>
        metric === 'steel' ? ok({ ...fullSeries.steel, metric, range, changePct: 0 }) : undefined,
    });
    renderPage();
    const headline = await screen.findByText(/0\.0% over 1Y/);
    expect(headline).toHaveTextContent(/^0\.0% over 1Y$/);
    expect(
      screen.getByRole('img', { name: 'Steel price index: 0.0% over 1Y' })
    ).toBeInTheDocument();
  });

  it('shows outstanding by age with the advances footnote', async () => {
    useApi();
    renderPage();
    const card = (await screen.findByRole('heading', { name: 'Outstanding by age' })).closest(
      'section'
    ) as HTMLElement;
    expect(within(card).getByText('90+ days')).toBeInTheDocument();
    expect(within(card).getByText('₹90,000')).toBeInTheDocument();
    // the total is the card's headline, in full
    expect(within(card).getByText('₹3,00,000')).toHaveClass('mono');
    expect(card).toHaveTextContent('₹3,00,000 outstanding');
    expect(within(card).getByText('₹12,000 in advances not shown')).toBeInTheDocument();
  });

  it('lists stock and parties with bars and links', async () => {
    useApi();
    renderPage();
    const stock = await screen.findByRole('list', { name: 'Stock' });
    const [props, plates] = within(stock).getAllByRole('listitem');
    expect(props).toHaveTextContent('Props 3m');
    expect(props).toHaveTextContent('248 at sites / 400');
    expect(props).toHaveTextContent('18 damaged or lost this year');
    expect(
      within(props).getByRole('img', { name: 'At sites 248 of 400, In yard 152 of 400' })
    ).toBeInTheDocument();
    expect(plates).not.toHaveTextContent('damaged');
    expect(screen.getByRole('link', { name: /All stock/ })).toHaveAttribute('href', '/inventory');

    const parties = screen.getByRole('list', { name: 'Parties' });
    const [mehta] = within(parties).getAllByRole('listitem');
    expect(within(mehta).getByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(mehta).toHaveTextContent('₹1,84,200');
    expect(mehta).toHaveTextContent('320 on site · 4 damaged or lost');
    expect(
      within(mehta).getByRole('img', { name: 'On site 320 of 324, Damaged or lost 4 of 324' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All parties/ })).toHaveAttribute('href', '/parties');
  });

  it('hides money tiles, the billing chart and aging for a role without bills/payments', async () => {
    const requests = useApi({
      summary: {
        stock: fullSummary.stock,
        onRentPct: 40,
        activeSites: 3,
        rentPerDay: 900,
        parties: [{ partyId: 'p1', name: 'Mehta Builders', onSite: 10, damagedLost: 0 }],
      },
    });
    renderPage();
    expect(await screen.findByText('Active sites')).toBeInTheDocument();
    expect(screen.queryByText('Billed this month')).not.toBeInTheDocument();
    expect(screen.queryByText('Collected this month')).not.toBeInTheDocument();
    expect(screen.queryByText('Avg days to get paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding by age')).not.toBeInTheDocument();
    expect(screen.queryByText('Billed vs collected')).not.toBeInTheDocument();
    expect(await screen.findByText('avg 75% on rent')).toBeInTheDocument();
    const parties = screen.getByRole('list', { name: 'Parties' });
    expect(within(parties).getByRole('listitem')).toHaveTextContent('10 on site');
    expect(within(parties).getByRole('listitem')).not.toHaveTextContent('₹');
    expect(requests.some(r => r.startsWith('billing'))).toBe(false);
  });

  it('hides stock sections and skips utilization without inventory access', async () => {
    const requests = useApi({
      summary: {
        billedThisMonth: fullSummary.billedThisMonth,
        collectedThisMonth: fullSummary.collectedThisMonth,
        avgDaysToPay: 10,
        aging: fullSummary.aging,
      },
    });
    renderPage();
    expect(await screen.findByText('Billed this month')).toBeInTheDocument();
    expect(screen.queryByText(/Stock on rent/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Stock' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Parties' })).not.toBeInTheDocument();
    expect(await screen.findByText(/6\.0% over 1Y/)).toBeInTheDocument();
    expect(requests.some(r => r.startsWith('utilization'))).toBe(false);
  });

  it('shows zeros and empty states for a brand-new business', async () => {
    useApi({ summary: emptySummary, overdue: [], series: emptySeries });
    renderPage();
    const billed = (await screen.findByText('Billed this month')).parentElement as HTMLElement;
    expect(within(billed).getByText('₹0')).toBeInTheDocument();
    expect(within(billed).queryByText(/vs last month/)).not.toBeInTheDocument();
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(await screen.findAllByText('No data yet')).toHaveLength(2);
    expect(await screen.findByText('Steel index not available')).toBeInTheDocument();
    expect(screen.getByText('Nothing outstanding')).toBeInTheDocument();
    // a list, not a chart: the empty card collapses to its content height
    expect(screen.getByText('Nothing outstanding').closest('.body')).toHaveClass('fit');
    const aging = screen
      .getByRole('heading', { name: 'Outstanding by age' })
      .closest('section') as HTMLElement;
    expect(aging).toHaveTextContent('₹0 outstanding');
    expect(screen.getByText('No stock yet')).toBeInTheDocument();
    expect(screen.getByText('No parties on rent yet')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('keeps the page when the steel or billing series fails', async () => {
    useApi({
      series: metric =>
        metric === 'steel'
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : metric === 'billing'
            ? HttpResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
            : undefined,
    });
    renderPage();
    expect(await screen.findByText('Steel index not available')).toBeInTheDocument();
    expect(await screen.findByText('Not available')).toBeInTheDocument();
    expect(await screen.findByText('avg 75% on rent')).toBeInTheDocument();
    expect(screen.getByText('Billed this month')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('clamps the stock on rent tile to 100% like the chart', async () => {
    useApi({ summary: { ...fullSummary, onRentPct: 130 } });
    renderPage();
    const tile = (await screen.findByText('Stock on rent')).parentElement as HTMLElement;
    expect(within(tile).getByText('100%')).toBeInTheDocument();
  });

  it('shows a flat month as 0% without a direction', async () => {
    useApi({
      summary: { billedThisMonth: { value: 500, previous: 500 } },
    });
    renderPage();
    expect(await screen.findByText('0% vs last month')).toBeInTheDocument();
  });

  it('shows an error with retry when the summary fails, keeping the overdue table', async () => {
    useApi();
    server.use(
      http.get(apiUrl('/businesses/biz-1/dashboard/summary'), () =>
        HttpResponse.json({ success: false, message: 'Summary down' }, { status: 500 })
      )
    );
    renderPage();
    expect(await screen.findByText('Summary down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
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

  it('opens an overdue bill on row click with the overdue list as context', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Mehta Builders'));
    expect(screen.getByTestId('where')).toHaveTextContent('/bills/b1');
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '').recordNav).toEqual({
      paths: ['/bills/b1'],
      index: 0,
    });
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
    await screen.findByText('Active sites');
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
