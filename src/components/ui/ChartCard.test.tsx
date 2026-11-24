import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readCss } from '../../test/readCss';
import { ChartCard } from './ChartCard';

describe('ChartCard', () => {
  it('renders title, headline and children', () => {
    render(
      <ChartCard title="Billing" headline={<span>₹1,000</span>}>
        <div>chart body</div>
      </ChartCard>
    );
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
    expect(screen.getByText('chart body')).toBeInTheDocument();
  });

  it('keeps the chart height by default; fitContent sizes a non-chart body to its content', async () => {
    const { rerender } = render(
      <ChartCard title="Billing">
        <div>chart body</div>
      </ChartCard>
    );
    expect(screen.getByText('chart body').parentElement).not.toHaveClass('fit');
    rerender(
      <ChartCard title="Aging" fitContent>
        <p>Nothing outstanding</p>
      </ChartCard>
    );
    expect(screen.getByText('Nothing outstanding').parentElement).toHaveClass('body', 'fit');
    const css = await readCss('src/components/ui/ChartCard.module.css');
    expect(css).toMatch(/\.body\.fit \{[^}]*min-height: 0;/);
  });

  it('renders presets as radios, labels ALL as "All", and reports a change', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(
      <ChartCard
        title="Billing"
        presets={['3M', '1Y', 'ALL']}
        range="1Y"
        onRangeChange={onRangeChange}
      >
        <div />
      </ChartCard>
    );
    expect(screen.getByRole('radiogroup', { name: 'Chart range' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1Y' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '3M' }));
    expect(onRangeChange).toHaveBeenCalledWith('3M');
  });

  it('omits the range control without presets', () => {
    render(
      <ChartCard title="Steel">
        <div />
      </ChartCard>
    );
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('shows a spinner instead of the chart while loading', () => {
    render(
      <ChartCard title="Billing" loading>
        <div>chart body</div>
      </ChartCard>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();
  });

  it('shows the empty message instead of the chart', () => {
    render(
      <ChartCard title="Billing" empty="No bills in this range">
        <div>chart body</div>
      </ChartCard>
    );
    expect(screen.getByText('No bills in this range')).toBeInTheDocument();
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();
  });

  it('renders a numeric 0 headline but not a missing one', () => {
    const { rerender } = render(
      <ChartCard title="Billing" headline={0}>
        <div />
      </ChartCard>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    rerender(
      <ChartCard title="Billing">
        <div />
      </ChartCard>
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders an optional subtitle under the title', () => {
    render(
      <ChartCard title="Steel price index" subtitle="Govt WPI · monthly">
        <div />
      </ChartCard>
    );
    expect(screen.getByText('Govt WPI · monthly')).toBeInTheDocument();
  });

  it('renders header actions beside the title', () => {
    render(
      <ChartCard title="Stock" actions={<button type="button">All stock</button>}>
        <div />
      </ChartCard>
    );
    expect(screen.getByRole('button', { name: 'All stock' })).toBeInTheDocument();
  });
});
