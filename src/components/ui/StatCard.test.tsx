import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('shows label and value', () => {
    render(<StatCard label="Outstanding" value="₹1,200" />);
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText('₹1,200')).toHaveClass('mono');
  });

  it('applies the highlight class for the highlight tone', () => {
    const { container } = render(<StatCard label="L" value="1" tone="highlight" />);
    expect(container.firstChild).toHaveClass('highlight');
  });

  it('does not highlight by default', () => {
    const { container } = render(<StatCard label="L" value="1" className="x" />);
    expect(container.firstChild).not.toHaveClass('highlight');
    expect(container.firstChild).toHaveClass('x');
  });

  it('renders an icon and children', () => {
    const { container } = render(
      <StatCard label="L" value="1" icon="plus">
        <p>extra</p>
      </StatCard>
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();
  });
});
