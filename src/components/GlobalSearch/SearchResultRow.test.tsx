import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchResultRow } from './SearchResultRow';
import type { SearchResult } from './searchEngine';

function makeResult(over: Partial<SearchResult> = {}): SearchResult {
  return {
    key: 'PARTY:1',
    tag: 'PARTY',
    title: 'Sharma Contractors',
    subtitle: 'SHA-01',
    href: '/parties/1',
    score: 1,
    ...over,
  };
}

function renderRow(
  result: SearchResult,
  extra: Partial<Parameters<typeof SearchResultRow>[0]> = {}
) {
  const onPick = vi.fn();
  const onHover = vi.fn();
  render(
    <ul>
      <SearchResultRow
        id="r1"
        result={result}
        query="sha"
        selected={false}
        onHover={onHover}
        onPick={onPick}
        {...extra}
      />
    </ul>
  );
  return { onPick, onHover };
}

describe('SearchResultRow', () => {
  it('shows the tag in sentence case and highlights the match', () => {
    renderRow(makeResult());

    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getAllByText('Sha')[0].tagName).toBe('MARK');
    expect(screen.getByText('-01')).toBeInTheDocument();
  });

  it.each([
    ['AGREEMENT', 'Agreement'],
    ['INVENTORY', 'Inventory'],
    ['CHALLAN', 'Challan'],
    ['BILL', 'Bill'],
  ] as const)('labels %s as %s', (tag, label) => {
    renderRow(makeResult({ tag }));
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the delivery or return badge next to the number', () => {
    renderRow(makeResult({ tag: 'CHALLAN', title: 'CH-0042', badge: 'return' }));
    expect(screen.getByText('return')).toBeInTheDocument();
  });

  it('shows the matched site for a party found by site', () => {
    renderRow(makeResult({ viaSite: 'Andheri site' }));

    expect(screen.getByText('via site:', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('-01')).not.toBeInTheDocument();
  });

  it('joins subtitle and site for an agreement', () => {
    renderRow(makeResult({ tag: 'AGREEMENT', href: '/agreements/AG-9', viaSite: 'Pune' }));

    expect(screen.getByRole('option')).toHaveAttribute('title', 'AG-9');
    expect(screen.getByText('·', { exact: false })).toBeInTheDocument();
  });

  it('calls onPick on click and onHover on mouse move when not selected', async () => {
    const { onPick, onHover } = renderRow(makeResult());
    const user = userEvent.setup();

    await user.hover(screen.getByRole('option'));
    await user.click(screen.getByRole('option'));

    expect(onHover).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledOnce();
  });

  it('does not re-fire hover when already selected', async () => {
    const { onHover } = renderRow(makeResult(), { selected: true });
    await userEvent.setup().hover(screen.getByRole('option'));

    expect(onHover).not.toHaveBeenCalled();
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });
});
