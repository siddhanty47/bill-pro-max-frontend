import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScanReviewPanel from './ScanReviewPanel';
import type { ExtractedChallanData } from '../../types';

const result = (over: Partial<ExtractedChallanData> = {}): ExtractedChallanData => ({
  type: 'delivery',
  challanNumber: null,
  date: null,
  partyName: 'Mehta',
  partyId: 'p1',
  partyGstin: null,
  siteAddress: null,
  agreementId: null,
  items: [{ itemName: 'Steel Pipe', itemId: 'i1', quantity: 4 }],
  damagedItems: [],
  transporterName: null,
  vehicleNumber: null,
  cartageAmount: null,
  confidence: 'high',
  warnings: [],
  ...over,
});

describe('ScanReviewPanel', () => {
  it('shows a clean high-confidence scan as a success status with nothing flagged', () => {
    render(<ScanReviewPanel result={result()} onDismiss={vi.fn()} />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Scan review');
    expect(notice.className).toMatch(/success/);
    expect(screen.getByText('High confidence').className).toMatch(/success/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists what was read and what was not matched, plus warnings', () => {
    render(
      <ScanReviewPanel
        result={result({
          confidence: 'low',
          partyId: null,
          partyGstin: '27ABCDE1234F1Z5',
          siteAddress: 'Plot 12, Baner',
          items: [
            { itemName: 'Steel Pipe', itemId: 'i1', quantity: 4 },
            { itemName: 'Bolt', itemId: null, quantity: 1 },
            { itemName: 'Nut', itemId: null, quantity: 1 },
          ],
          warnings: ['Total does not match', 'Date unclear'],
        })}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('status').className).toMatch(/warning/);
    expect(screen.getByText('Low confidence').className).toMatch(/danger/);
    const table = screen.getByRole('table', { name: 'Read from photo' });
    const rows = within(table).getAllByRole('row');
    expect(rows.map(r => r.textContent)).toEqual([
      'GSTIN read27ABCDE1234F1Z5',
      'Site readPlot 12, Baner',
      'Party not matchedMehta. Select it below.',
      'Items not matchedBolt, Nut. Select them below.',
    ]);
    expect(within(table).getByText('27ABCDE1234F1Z5').className).toMatch(/mono/);
    expect(
      within(screen.getByRole('list', { name: 'Warnings' }))
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['Total does not match', 'Date unclear']);
  });

  it('uses the singular for one unmatched item and flags medium confidence', () => {
    render(
      <ScanReviewPanel
        result={result({
          confidence: 'medium',
          items: [{ itemName: 'Bolt', itemId: null, quantity: 1 }],
        })}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('Medium confidence').className).toMatch(/warning/);
    expect(screen.getByRole('row').textContent).toBe('Item not matchedBolt. Select it below.');
  });

  it('dismisses', async () => {
    const onDismiss = vi.fn();
    render(<ScanReviewPanel result={result()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss scan review' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
