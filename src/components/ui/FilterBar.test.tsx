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
  // so read the stylesheet source (resolved next to this file) and check the rules exist.
  // The file name is a parameter on purpose: Vite rewrites a literal
  // `new URL('./x.css', import.meta.url)` into a served asset path.
  async function readCss(file: string) {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: URL, encoding: 'utf8'): string;
    };
    return fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  }

  it('lets the search box grow from 240px in a row (same sizing as before)', async () => {
    const bar = await readCss('./FilterBar.module.css');
    const search = await readCss('./SearchInput.module.css');
    expect(bar).toMatch(/--search-flex:\s*1 1 240px/);
    expect(search).toMatch(/flex:\s*var\(--search-flex,\s*0 1 auto\)/);
  });

  it('stacks children full width at ≤480', async () => {
    const css = await readCss('./FilterBar.module.css');
    const block = css.slice(css.indexOf('@media (max-width: 480px)'));
    expect(block).toMatch(/\.bar\s*>\s*\*\s*\{[^}]*flex:\s*1 1 100%/);
  });
});
