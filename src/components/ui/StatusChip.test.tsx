import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('derives label and tone from the status', () => {
    render(<StatusChip status="OVERDUE" />);
    const chip = screen.getByText('Overdue');
    expect(chip).toHaveClass('chip');
    expect(chip).toHaveClass('danger');
  });

  it('falls back to neutral for unknown statuses', () => {
    render(<StatusChip status="Mystery" />);
    expect(screen.getByText('Mystery')).toHaveClass('neutral');
  });

  it('lets children override the label and tone override the tone', () => {
    render(
      <StatusChip status="paid" tone="info">
        Settled
      </StatusChip>
    );
    const chip = screen.getByText('Settled');
    expect(chip).toHaveClass('info');
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
  });
});
