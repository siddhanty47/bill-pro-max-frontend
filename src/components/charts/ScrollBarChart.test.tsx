import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ScrollBarChartDefault, { ScrollBarChart, type ScrollBarChartProps } from './ScrollBarChart';
import { barLabel, niceTicks } from './chartFormat';

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
      ariaLabel="Stock: 3 items"
      {...props}
    />
  );
}

const plotBars = () => screen.getByRole('region').querySelectorAll('.recharts-bar-rectangle');

describe('barLabel', () => {
  it('keeps short codes, truncates long ones and falls back to name initials', () => {
    expect(barLabel('CPL', 'Coupler')).toBe('CPL');
    expect(barLabel('ABCDEFGH', 'x')).toBe('ABCDEFGH');
    expect(barLabel('ABCDEFGHIJ', 'x')).toBe('ABCDEFG…');
    expect(barLabel('', 'mehta builders pvt ltd')).toBe('MBP');
    expect(barLabel(undefined, 'Props')).toBe('P');
    expect(barLabel('  ', '')).toBe('?');
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
    const region = screen.getByRole('region', { name: 'Stock: 3 items' });
    expect(screen.getByRole('img', { name: 'Stock: 3 items' })).toBeInTheDocument();
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

  it('calls onBarClick with the row', () => {
    const onBarClick = vi.fn();
    const data = rows(2);
    renderChart({ data, onBarClick });
    fireEvent.click(plotBars()[1]);
    expect(onBarClick).toHaveBeenCalledWith(data[1]);
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
});
