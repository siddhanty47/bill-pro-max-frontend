import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Brand } from './Brand';

describe('Brand', () => {
  it('renders the wordmark with the brand mark', () => {
    const { container } = render(<Brand />);
    expect(screen.getByText('Bill Pro Max')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    expect(container.firstElementChild).toHaveClass('brand', 'md');
  });

  it('supports the small size and a placement class', () => {
    const { container } = render(<Brand size="sm" className="place" />);
    expect(container.firstElementChild).toHaveClass('brand', 'sm', 'place');
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
