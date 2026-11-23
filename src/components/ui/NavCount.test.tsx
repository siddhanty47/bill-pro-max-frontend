import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NavCount } from './NavCount';

describe('NavCount', () => {
  it('renders nothing for 0 or undefined', () => {
    expect(render(<NavCount value={0} />).container).toBeEmptyDOMElement();
    expect(render(<NavCount />).container).toBeEmptyDOMElement();
  });

  it('renders a decorative pill with the number and label, plus hidden text', () => {
    const { container } = render(
      <NavCount value={7} label="overdue" tone="danger" description="overdue bills" />
    );
    const pill = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(pill).toHaveClass('pill', 'danger');
    expect(pill.textContent).toBe('7 overdue');
    expect(container.textContent).toContain(', 7 overdue bills');
  });

  it('defaults to neutral and uses the number as hidden text', () => {
    const { container } = render(<NavCount value={142} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('neutral');
    expect(container.textContent).toBe(', 142142');
  });

  it('formats large numbers en-IN and caps at 999+', () => {
    expect(render(<NavCount value={999} />).container.textContent).toContain('999');
    const big = render(<NavCount value={1000} />).container;
    expect(big.querySelector('[aria-hidden="true"]')?.textContent).toBe('999+');
    expect(big.textContent).toContain(', 1,000');
  });
});
