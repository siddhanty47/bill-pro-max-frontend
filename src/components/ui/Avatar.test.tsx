import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials as a hidden, non-interactive span', () => {
    const { container } = render(<Avatar initials="SY" />);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveTextContent('SY');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('defaults to a medium person avatar', () => {
    const { container } = render(<Avatar initials="SY" />);
    expect(container.firstElementChild).toHaveClass('avatar', 'md', 'person');
  });

  it('renders the small business badge and merges className', () => {
    const { container } = render(
      <Avatar initials="A" size="sm" variant="business" className="placed" />
    );
    expect(container.firstElementChild).toHaveClass('sm', 'business', 'placed');
  });
});
