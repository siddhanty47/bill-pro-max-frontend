import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ScrollBarChart } from './ScrollBarChart';

// Count BarChart renders: scrolling or hovering must not re-render the (large) charts.
const rendered = vi.hoisted(() => vi.fn());
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>();
  function BarChart(props: ComponentProps<typeof actual.BarChart>) {
    rendered();
    return <actual.BarChart {...props} />;
  }
  return { ...actual, BarChart };
});

type Row = { code: string; name: string; a: number };
const data: Row[] = Array.from({ length: 300 }, (_, i) => ({
  code: `C${i}`,
  name: `Item ${i}`,
  a: i + 1,
}));
const stacks = [{ key: 'a' as const, label: 'At sites', tone: 'accent' as const }];
const format = (n: number) => String(n);
const tooltip = (r: Row) => ({ title: r.name, rows: [] });

const renderChart = () =>
  render(
    <ScrollBarChart<Row>
      data={data}
      xKey="code"
      nameKey="name"
      stacks={stacks}
      format={format}
      tooltip={tooltip}
      title="Stock"
      ariaLabel="Stock: 300 items"
    />
  );

describe('ScrollBarChart rendering', () => {
  it('does not re-render the charts on scroll', () => {
    renderChart();
    const region = screen.getByRole('region');
    const before = rendered.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    for (let left = 50; left <= 500; left += 50) {
      region.scrollLeft = left;
      fireEvent.scroll(region);
    }
    expect(rendered.mock.calls.length).toBe(before);
  });

  it('moves a hovered card on scroll without re-rendering the charts', async () => {
    renderChart();
    const region = screen.getByRole('region');
    const plot = region.querySelector('.recharts-wrapper') as Element;
    fireEvent.mouseMove(plot, { clientX: 56 + 28, clientY: 100 });
    const card = (await screen.findByText('Item 1', { selector: '.tooltipTitle' }))
      .parentElement as HTMLElement;
    const before = rendered.mock.calls.length;
    const left = card.style.getPropertyValue('--tip-left');
    region.scrollLeft = 100;
    fireEvent.scroll(region);
    expect(card.style.getPropertyValue('--tip-left')).not.toBe(left);
    expect(rendered.mock.calls.length).toBe(before);
  });
});
