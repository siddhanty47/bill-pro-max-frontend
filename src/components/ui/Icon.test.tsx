import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Icon, type IconName } from './Icon';

const names: IconName[] = [
  'dashboard',
  'inventory',
  'parties',
  'agreements',
  'challans',
  'bills',
  'payments',
  'team',
  'search',
  'bell',
  'chat',
  'chevron-down',
  'plus',
  'close',
  'menu',
  'more',
  'arrow-left',
  'arrow-right',
  'rupee',
  'settings',
  'logout',
  'paperclip',
  'mic',
  'stop',
  'brand',
];

describe('Icon', () => {
  it.each(names)('renders the %s icon', name => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelector('path, rect, circle')).toBeInTheDocument();
  });

  it('applies size and className', () => {
    const { container } = render(<Icon name="plus" size={24} className="x" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveClass('x');
  });

  it('uses the larger stroke on the brand mark', () => {
    const { container } = render(<Icon name="brand" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2');
  });
});
