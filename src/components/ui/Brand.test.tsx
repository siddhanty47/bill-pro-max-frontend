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

  it('collapseName keeps the wordmark in the DOM with the collapsible hook', () => {
    render(<Brand collapseName />);
    expect(screen.getByText('Bill Pro Max')).toHaveClass('collapsible');
  });

  it('hides the wordmark visually only at phone width (CSS present)', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/Brand.module.css', 'utf8');
    const block = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(block).toMatch(/\.collapsible\s*\{[^}]*clip:\s*rect/);
  });

  it('supports the small size and a placement class', () => {
    const { container } = render(<Brand size="sm" className="place" />);
    expect(container.firstElementChild).toHaveClass('brand', 'sm', 'place');
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
