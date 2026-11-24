import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NegativeStockNotice } from './NegativeStockNotice';
import { NEGATIVE_STOCK_NOTE, hasNegativeStock, stockTone } from '../../utils/stock';

describe('NegativeStockNotice', () => {
  it('warns when any count is below zero', () => {
    render(<NegativeStockNotice quantities={[5, -18]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Some counts are below zero');
    expect(screen.getByRole('status')).toHaveTextContent(NEGATIVE_STOCK_NOTE);
  });

  it('renders nothing when every count is zero or more', () => {
    const { container } = render(<NegativeStockNotice quantities={[0, 3]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('stock helpers', () => {
  it('tones only negative counts', () => {
    expect(stockTone(-1)).toBe('negative');
    expect(stockTone(0)).toBeUndefined();
    expect(hasNegativeStock([])).toBe(false);
  });
});
