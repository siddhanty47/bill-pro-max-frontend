import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
