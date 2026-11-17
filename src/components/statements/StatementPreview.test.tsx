import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatementPreview } from './StatementPreview';
import type { StatementData } from '../../types';

const party = { name: 'Mehta Builders', code: 'MEHT' };
const common = { business: { name: 'Biz' }, party, currency: 'INR' };
const period = { from: '2024-01-05', to: '2024-02-10' };

describe('StatementPreview', () => {
  it.each<[string, StatementData, RegExp]>([
    [
      'ledger',
      {
        type: 'ledger',
        ...common,
        period,
        openingBalance: 0,
        entries: [],
        totalDebits: 0,
        totalCredits: 0,
        closingBalance: 0,
      },
      /ledger statement/i,
    ],
    [
      'bills',
      { type: 'bills', ...common, period, bills: [], totals: {} as never },
      /bill statement/i,
    ],
    [
      'items',
      { type: 'items', ...common, period, items: [], grandTotals: {} as never },
      /item statement/i,
    ],
    [
      'aging',
      {
        type: 'aging',
        ...common,
        asOfDate: '2024-03-01',
        bills: [],
        buckets: {} as never,
        grandTotal: 0,
      },
      /aging statement/i,
    ],
  ])('renders the %s preview', (_type, data, title) => {
    renderWithProviders(<StatementPreview data={data} />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('renders nothing for an unknown type', () => {
    const { container } = renderWithProviders(
      <StatementPreview data={{ type: 'other' } as unknown as StatementData} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
