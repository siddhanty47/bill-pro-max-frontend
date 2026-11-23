import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendLabel } from './TrendLabel';

describe('TrendLabel', () => {
  it('shows ▲ to sighted users and says "up" to screen readers', () => {
    const { container } = render(<TrendLabel direction="up">12% vs last month</TrendLabel>);
    const arrow = screen.getByText('▲', { exact: false });
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('up', { exact: false })).toHaveClass('hidden');
    expect(container).toHaveTextContent('▲ up 12% vs last month');
  });

  it('uses ▼ and "down" for a fall', () => {
    render(<TrendLabel direction="down">2.1% over 3Y</TrendLabel>);
    expect(screen.getByText('▼', { exact: false })).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('down', { exact: false })).toHaveClass('hidden');
  });
});
