import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BarLineChartDefault, { BarLineChart } from './BarLineChart';
import LineChartDefault, { LineChart } from './LineChart';
import { ChartTooltip } from './ChartTooltip';
import type { SeriesPoint } from '../../types';

const SIZE = { width: 600, height: 240 };
const money = (n: number) => `₹${n}`;
const billing: SeriesPoint[] = [
  { t: '2025-09-01', billed: 100, collected: 80 },
  { t: '2025-10-01', billed: 200, collected: 150 },
  { t: '2025-11-01', billed: 300, collected: 250 },
];

describe('BarLineChart', () => {
  it('exports default and named for React.lazy', () => {
    expect(BarLineChartDefault).toBe(BarLineChart);
  });

  it('renders one bar per point, the legend and month tick labels', () => {
    const { container } = render(
      <BarLineChart
        size={SIZE}
        data={billing}
        bucket="month"
        bar={{ key: 'billed', label: 'Billed' }}
        line={{ key: 'collected', label: 'Collected' }}
        format={money}
      />
    );
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(3);
    expect(screen.getByText('Billed')).toBeInTheDocument();
    expect(screen.getByText('Collected')).toBeInTheDocument();
    expect(screen.getByText('Nov 25')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  it('exports default and named for React.lazy', () => {
    expect(LineChartDefault).toBe(LineChart);
  });

  it('renders the line and day tick labels', () => {
    const { container } = render(
      <LineChart
        size={SIZE}
        data={[
          { t: '2025-11-16', pct: 40 },
          { t: '2025-11-23', pct: 55 },
        ]}
        bucket="week"
        y={{ key: 'pct', label: 'Utilization' }}
        domain={[0, 100]}
        format={n => `${n}%`}
      />
    );
    expect(container.querySelector('.recharts-line-curve')).not.toBeNull();
    expect(screen.getByText('23 Nov')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});

describe('ChartTooltip', () => {
  it('shows the full date and a formatted value per series', () => {
    render(
      <ChartTooltip
        active
        label="2025-11-23"
        bucket="week"
        format={money}
        payload={[{ dataKey: 'billed', name: 'Billed', value: 300 }]}
      />
    );
    expect(screen.getByText('Week of 23 Nov 2025')).toBeInTheDocument();
    expect(screen.getByText('Billed')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
  });

  it('renders nothing when inactive or empty', () => {
    const { container } = render(
      <ChartTooltip active={false} bucket="day" format={money} payload={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
