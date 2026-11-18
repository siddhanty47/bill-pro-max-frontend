import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleIcon } from './GoogleIcon';

describe('GoogleIcon', () => {
  it('renders a decorative svg with the four logo paths', () => {
    const { container } = render(<GoogleIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg?.querySelectorAll('path')).toHaveLength(4);
  });

  it('accepts a size and className', () => {
    const { container } = render(<GoogleIcon size={20} className="logo" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveClass('logo');
  });
});
