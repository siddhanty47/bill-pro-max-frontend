import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Dot } from './Dot';

describe('Dot', () => {
  it.each(['info', 'warning', 'success', 'danger'] as const)(
    'renders a decorative %s dot',
    tone => {
      const { container } = render(<Dot tone={tone} />);
      const dot = container.firstChild as HTMLElement;
      expect(dot).toHaveClass('dot', tone);
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    }
  );

  it('merges a placement className', () => {
    const { container } = render(<Dot tone="info" className="lead" />);
    expect(container.firstChild).toHaveClass('dot', 'info', 'lead');
  });
});
