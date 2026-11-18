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
});
