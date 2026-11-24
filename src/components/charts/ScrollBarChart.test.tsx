import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ScrollBarChartDefault, { ScrollBarChart, type ScrollBarChartProps } from './ScrollBarChart';
import { barLabel, niceTicks, tipLeft } from './chartFormat';
import { readCss } from '../../test/readCss';

type Row = { id: string; code: string; name: string; a: number; b: number };

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    code: `C${i}`,
    name: `Item ${i}`,
    a: 10 * (i + 1),
    b: 5,
  }));

function renderChart(props: Partial<ScrollBarChartProps<Row>> = {}) {
  return render(
    <ScrollBarChart<Row>
      data={rows(3)}
      xKey="code"
      nameKey="name"
      stacks={[
        { key: 'a', label: 'At sites', tone: 'accent' },
        { key: 'b', label: 'In yard', tone: 'muted' },
      ]}
      format={n => String(n)}
      tooltip={r => ({ title: `${r.name} (${r.code})`, rows: [{ label: 'At sites', value: '1' }] })}
      title="Stock"
      ariaLabel="Stock: 3 items"
      {...props}
    />
  );
}

const plotBars = () => screen.getByRole('region').querySelectorAll('.recharts-bar-rectangle');

/** Recharts maps the pointer to a slot from clientX (jsdom has no layout offsets). */
const pointAt = (slot: number) => ({ clientX: slot * 56 + 28, clientY: 100 });
const plot = () => screen.getByRole('region').querySelector('.recharts-wrapper') as Element;

/** `(hover: none)` = a touch screen. */
function stubTouch(touch: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: touch && query === '(hover: none)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('barLabel', () => {
  it('keeps short codes, truncates long ones and falls back to name initials', () => {
    expect(barLabel('CPL', 'Coupler')).toBe('CPL');
    expect(barLabel('ABCDEFG', 'x')).toBe('ABCDEFG');
    expect(barLabel('ABCDEFGH', 'x')).toBe('ABCDEF…');
    expect(barLabel('', 'mehta builders pvt ltd')).toBe('MBP');
    expect(barLabel(undefined, 'Props')).toBe('P');
    expect(barLabel('  ', '')).toBe('?');
  });
});

describe('tipLeft', () => {
  it('puts the card right of the bar, else left of it, else against the right edge', () => {
    expect(tipLeft(100, 150, 375)).toBe(112);
    expect(tipLeft(300, 150, 375)).toBe(138);
    expect(tipLeft(100, 300, 320)).toBe(20);
    expect(tipLeft(100, 400, 320)).toBe(0);
  });
});

describe('niceTicks', () => {
  it('covers the max with round steps', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(248)).toEqual([0, 100, 200, 300]);
    expect(niceTicks(184200)).toEqual([0, 50000, 100000, 150000, 200000]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
  });
});

describe('ScrollBarChart', () => {
  it('exports default and named for React.lazy', () => {
    expect(ScrollBarChartDefault).toBe(ScrollBarChart);
  });

  it('renders one stacked bar per row with code ticks inside a named scroll region', () => {
    renderChart({ data: rows(10) });
    // the region and the image carry different names (no double announcement)
    const region = screen.getByRole('region', { name: 'Stock, scrollable' });
    expect(within(region).getByRole('img', { name: 'Stock: 3 items' })).toBeInTheDocument();
    // two stacks × 10 rows
    expect(plotBars()).toHaveLength(20);
    // (Recharts also leaves a text-measuring span in the body, so look inside the region)
    expect(within(region).getByText('C0')).toBeInTheDocument();
    expect(within(region).getByText('C9')).toBeInTheDocument();
  });

  it('keeps the y-axis outside the scrolling plot', () => {
    const { container } = renderChart();
    const region = screen.getByRole('region');
    const axis = container.querySelector('.scrollAxis') as HTMLElement;
    expect(axis).toHaveAttribute('aria-hidden', 'true');
    expect(region.contains(axis)).toBe(false);
    expect(within(axis).getByText('30')).toBeInTheDocument();
    expect(within(region).queryByText('30')).not.toBeInTheDocument();
  });

  it('gives each bar a fixed slot so many rows scroll instead of squeezing', () => {
    renderChart({ data: rows(300), slotWidth: 56 });
    const svg = screen.getByRole('region').querySelector('svg.recharts-surface');
    expect(svg).toHaveAttribute('width', String(300 * 56));
    expect(plotBars()).toHaveLength(600);
  });

  it('renders an empty plot without errors for no rows', () => {
    renderChart({ data: [] });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('shows the card for the hovered slot and hides it on leave', async () => {
    stubTouch(false);
    renderChart();
    fireEvent.mouseMove(plot(), pointAt(1));
    // Recharts throttles mouse moves to an animation frame
    const title = await screen.findByText('Item 1 (C1)');
    // drawn over the frame, outside the clipping scroll viewport
    expect(screen.getByRole('region').contains(title)).toBe(false);
    fireEvent.mouseLeave(plot());
    expect(screen.queryByText('Item 1 (C1)')).not.toBeInTheDocument();
  });

  it('opens a bar on click anywhere in its slot with a mouse', async () => {
    stubTouch(false);
    const onBarClick = vi.fn();
    const data = rows(2);
    renderChart({ data, onBarClick, tooltip: r => ({ title: r.name, rows: [], hint: 'Open →' }) });
    fireEvent.mouseMove(plot(), pointAt(1));
    expect(await screen.findByText('Open →')).toBeInTheDocument();
    fireEvent.click(plot(), pointAt(1));
    expect(onBarClick).toHaveBeenCalledTimes(1);
    expect(onBarClick).toHaveBeenCalledWith(data[1]);
  });

  it('previews on the first tap and opens on a second tap of the same bar (touch)', async () => {
    stubTouch(true);
    const onBarClick = vi.fn();
    const data = rows(3);
    renderChart({ data, onBarClick, tooltip: r => ({ title: r.name, rows: [], hint: 'Open →' }) });
    // a tap also emits a mouse move: it must not count as the first tap
    fireEvent.mouseMove(plot(), pointAt(1));
    fireEvent.click(plot(), pointAt(1));
    expect(onBarClick).not.toHaveBeenCalled();
    expect(await screen.findByText('Item 1', { selector: '.tooltipTitle' })).toBeInTheDocument();
    expect(screen.getByText('Tap again to open')).toBeInTheDocument();
    expect(screen.queryByText('Open →')).not.toBeInTheDocument();
    // a tap on another bar moves the preview
    fireEvent.click(plot(), pointAt(2));
    expect(onBarClick).not.toHaveBeenCalled();
    expect(await screen.findByText('Item 2', { selector: '.tooltipTitle' })).toBeInTheDocument();
    fireEvent.click(plot(), pointAt(2));
    expect(onBarClick).toHaveBeenCalledWith(data[2]);
  });

  it('drops a tapped card on a tap outside the plot (touch)', async () => {
    stubTouch(true);
    renderChart({ onBarClick: vi.fn() });
    fireEvent.click(plot(), pointAt(0));
    expect(await screen.findByText('Item 0 (C0)')).toBeInTheDocument();
    fireEvent.pointerDown(plot().querySelector('svg') as Element);
    expect(screen.getByText('Item 0 (C0)')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('Item 0 (C0)')).not.toBeInTheDocument();
  });

  it('drops a tapped card when the plot scrolls (touch)', () => {
    stubTouch(true);
    renderChart({ onBarClick: vi.fn() });
    fireEvent.click(plot(), pointAt(0));
    expect(screen.getByText('Item 0 (C0)')).toBeInTheDocument();
    fireEvent.scroll(screen.getByRole('region'));
    expect(screen.queryByText('Item 0 (C0)')).not.toBeInTheDocument();
  });

  it('keeps tiny values visible on a single series', () => {
    renderChart({
      data: [
        { id: 'big', code: 'B', name: 'Big', a: 1800000, b: 0 },
        { id: 'small', code: 'S', name: 'Small', a: 500, b: 0 },
      ],
      stacks: [{ key: 'a', label: 'Outstanding', tone: 'info' }],
    });
    const heights = [...plotBars()].map(b =>
      Number(b.querySelector('path')?.getAttribute('height') ?? 0)
    );
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(3);
  });

  it('rounds only the top segment of each bar', () => {
    const data = [
      { id: 'x', code: 'X', name: 'X', a: 10, b: 5 },
      { id: 'y', code: 'Y', name: 'Y', a: 10, b: 0 },
    ];
    renderChart({ data });
    const paths = [
      ...screen.getByRole('region').querySelectorAll('.recharts-bar-rectangle path'),
    ].map(p => p.getAttribute('d') ?? '');
    // a (x: bottom, square) · a (y: top since b is 0, rounded) · b (x: top, rounded)
    const rounded = paths.filter(d => d.includes('A'));
    expect(rounded).toHaveLength(2);
  });

  it('lists every bar for screen readers with the tooltip facts', () => {
    renderChart({
      tooltip: r => ({
        title: `${r.name} (${r.code})`,
        rows: [{ label: 'At sites', value: String(r.a) }],
      }),
    });
    const list = screen.getByRole('list', { name: 'Stock' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent('Item 1 (C1), At sites: 20');
    // outside the image (whose children are presentational) and visually hidden
    expect(screen.getByRole('img').contains(list)).toBe(false);
    expect(list).toHaveClass('srOnly');
  });

  it('draws axis ticks small and hides the screen-reader list (CSS)', async () => {
    const css = await readCss('src/components/charts/Chart.module.css');
    expect(css).toMatch(
      /\.scrollFrame :global\(\.recharts-cartesian-axis-tick-value\)\s*\{[^}]*font-size:\s*var\(--text-xs\)/
    );
    expect(css).toMatch(/\.srOnly\s*\{[^}]*clip: rect\(0 0 0 0\)/);
  });
});
