import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

  it('renders a clickable link when given to', () => {
    render(
      <MemoryRouter>
        <StatCard to="/x" label="L" value="1" />
      </MemoryRouter>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/x');
    expect(link).toHaveClass('clickable');
  });

  it('renders no link without to', () => {
    render(<StatCard label="L" value="1" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('StatCard value', () => {
  it('colours the value by valueTone', () => {
    render(
      <>
        <StatCard label="In" value="₹10" valueTone="positive" />
        <StatCard label="Out" value="₹5" valueTone="negative" />
        <StatCard label="Due" value="₹2" valueTone="warning" />
        <StatCard label="Plain" value="₹1" />
      </>
    );
    expect(screen.getByText('₹10')).toHaveClass('value', 'tone-positive');
    expect(screen.getByText('₹5')).toHaveClass('tone-negative');
    expect(screen.getByText('₹2')).toHaveClass('tone-warning');
    expect(screen.getByText('₹1').className).not.toMatch(/tone-/);
  });

  it('renders without a value (children only), but keeps a 0 value', () => {
    const { container } = render(
      <StatCard label="Stock">
        <p>meter</p>
      </StatCard>
    );
    expect(container.querySelector('.value')).toBeNull();
    expect(screen.getByText('meter')).toBeInTheDocument();
    render(<StatCard label="Overdue" value={0} />);
    expect(screen.getByText('0')).toHaveClass('value');
  });
});
