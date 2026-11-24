import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import type { PartyRow, StockRow } from '../../types';
import { PartiesPanel } from './PartiesPanel';
import { StockPanel } from './StockPanel';

const item = (i: number, over: Partial<StockRow> = {}): StockRow => ({
  itemId: `i${i}`,
  code: `IT${i}`,
  name: `Item ${i}`,
  unit: 'pcs',
  atSites: 100 - i,
  inYard: 10,
  damagedLost: 0,
  ...over,
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(ui: React.ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={ui} />
      <Route path="*" element={<Where />} />
    </Routes>
  );
}

/** Bars of the first (bottom) stack: one per row. */
const firstStackBars = (region: HTMLElement) =>
  region.querySelectorAll('.recharts-bar:first-of-type .recharts-bar-rectangle');

/** Recharts maps the pointer to a slot from clientX (jsdom has no layout offsets). */
const hoverSlot = (region: HTMLElement, slot: number, slotWidth = 56) =>
  fireEvent.mouseMove(region.querySelector('.recharts-wrapper') as Element, {
    clientX: slot * slotWidth + slotWidth / 2,
    clientY: 100,
  });

describe('StockPanel', () => {
  it('draws one bar per item with codes under the bars', async () => {
    const stock = Array.from({ length: 10 }, (_, i) => item(i));
    renderAt(<StockPanel stock={stock} />);
    await screen.findByRole('img', { name: /^Stock: 10 items/ });
    const region = screen.getByRole('region', { name: 'Stock, scrollable' });
    expect(firstStackBars(region)).toHaveLength(10);
    expect(within(region).getByText('IT0')).toBeInTheDocument();
    expect(within(region).getByText('IT9')).toBeInTheDocument();
    expect(screen.getByText('At sites')).toBeInTheDocument();
    expect(screen.getByText('In yard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All stock/ })).toHaveAttribute('href', '/inventory');
  });

  it('shows the full name and counts on hover, with damaged or lost only when there is some', async () => {
    renderAt(
      <StockPanel
        stock={[
          item(1, { code: 'CPL', name: 'Coupler', atSites: 248, inYard: 152, damagedLost: 18 }),
          item(2, { code: 'PLT', name: 'Plates', atSites: 100, inYard: 50 }),
        ]}
      />
    );
    const region = await screen.findByRole('region', { name: 'Stock, scrollable' });
    hoverSlot(region, 0);
    const tip = await screen.findByText('Coupler (CPL)');
    const card = tip.parentElement as HTMLElement;
    expect(card).toHaveTextContent('At sites248');
    expect(card).toHaveTextContent('In yard152');
    expect(card).toHaveTextContent('Total400');
    expect(card).toHaveTextContent('Damaged or lost in the last 12 months18');

    hoverSlot(region, 1);
    const plates = (await screen.findByText('Plates (PLT)')).parentElement as HTMLElement;
    expect(plates).not.toHaveTextContent('Damaged');
  });

  it('labels a bar by name initials when the code is missing', async () => {
    renderAt(<StockPanel stock={[item(1, { code: '', name: 'Steel props' })]} />);
    await screen.findByRole('img', { name: /^Stock: 1 item,/ });
    const region = screen.getByRole('region', { name: 'Stock, scrollable' });
    expect(within(region).getByText('SP')).toBeInTheDocument();
    hoverSlot(region, 0);
    expect(await screen.findByText('Steel props')).toBeInTheDocument();
  });

  it('says so when there is no stock', () => {
    renderAt(<StockPanel stock={[]} />);
    expect(screen.getByText('No stock yet')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

describe('PartiesPanel', () => {
  const parties: PartyRow[] = [
    { partyId: 'p1', code: 'MEH', name: 'Mehta Builders', outstanding: 184200 },
    { partyId: 'p2', code: 'SHA', name: 'Shah & Sons', outstanding: 5000.5 },
  ];

  it('draws a bar per party that owes money, highest first', async () => {
    renderAt(<PartiesPanel parties={parties} />);
    expect(screen.getByRole('heading', { name: 'Outstanding by party' })).toBeInTheDocument();
    expect(screen.getByText('Parties that owe you, highest first')).toBeInTheDocument();
    await screen.findByRole('img', { name: 'Outstanding by party: 2 parties, ₹1.9L' });
    const region = screen.getByRole('region', { name: 'Outstanding by party, scrollable' });
    expect(firstStackBars(region)).toHaveLength(2);
    const ticks = [...region.querySelectorAll('.recharts-xAxis-tick-labels tspan')].map(
      t => t.textContent
    );
    expect(ticks).toEqual(['MEH', 'SHA']);
    expect(screen.getByRole('link', { name: /All parties/ })).toHaveAttribute('href', '/parties');
  });

  it('shows the full amount on hover and opens the party on click', async () => {
    renderAt(<PartiesPanel parties={parties} />);
    const region = await screen.findByRole('region', { name: 'Outstanding by party, scrollable' });
    hoverSlot(region, 1);
    const card = (await screen.findByText('Shah & Sons (SHA)')).parentElement as HTMLElement;
    expect(card).toHaveTextContent('Outstanding₹5,000.50');
    expect(card).toHaveTextContent('Open party →');

    fireEvent.click(region.querySelector('.recharts-wrapper') as Element, {
      clientX: 28,
      clientY: 100,
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/parties/p1');
  });

  it('says nobody owes money for an empty list', () => {
    renderAt(<PartiesPanel parties={[]} />);
    expect(screen.getByText('Nobody owes you money')).toBeInTheDocument();
  });
});
