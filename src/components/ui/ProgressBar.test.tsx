import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('sets the fill width from value/max with an SVG attribute', () => {
    const { container } = render(<ProgressBar value={3} max={8} label="Progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    const rects = container.querySelectorAll('rect');
    expect(rects[1]).toHaveAttribute('width', '38%');
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('is empty when max is zero and clamps overflow', () => {
    const { container, rerender } = render(<ProgressBar value={2} max={0} label="P" />);
    expect(container.querySelectorAll('rect')[1]).toHaveAttribute('width', '0%');
    rerender(<ProgressBar value={9} max={4} label="P" className="x" />);
    expect(container.querySelectorAll('rect')[1]).toHaveAttribute('width', '100%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByRole('progressbar')).toHaveClass('x');
  });
});
