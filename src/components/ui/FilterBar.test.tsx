import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders its children', () => {
    render(
      <FilterBar>
        <button type="button">Status</button>
        <input aria-label="Search" />
      </FilterBar>
    );
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('merges className and forwards native props', () => {
    render(
      <FilterBar className="extra" data-testid="fb" aria-label="Filters" role="search">
        x
      </FilterBar>
    );
    const el = screen.getByTestId('fb');
    expect(el).toHaveClass('bar');
    expect(el).toHaveClass('extra');
    expect(screen.getByRole('search', { name: 'Filters' })).toBe(el);
  });

  // jsdom evaluates no media queries and vitest hands CSS modules back as class maps,
  // so read the stylesheet source (vitest runs from the repo root) and check the narrow-phone rule exists.
  it('stacks children full width at ≤480', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/FilterBar.module.css', 'utf8');
    const block = css.slice(css.indexOf('@media (max-width: 480px)'));
    expect(block).toMatch(/\.bar\s*>\s*\*\s*\{[^}]*flex:\s*1 1 100%/);
  });
});
