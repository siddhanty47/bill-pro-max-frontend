import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MeterList } from './MeterList';
import { MeterLegend } from './Meter';
import { readCss } from '../../test/readCss';

const rows = [
  {
    key: 'a',
    label: 'Props 3m',
    segments: [
      { value: 248, tone: 'accent' as const, label: 'At sites' },
      { value: 152, tone: 'muted' as const, label: 'In yard' },
    ],
    detail: '248 / 400',
    note: '18 damaged or lost in the last 12 months',
  },
  {
    key: 'b',
    label: 'Plates',
    segments: [{ value: 10, tone: 'accent' as const, label: 'At sites' }],
  },
];

describe('MeterList', () => {
  it('renders one row per item with label, bar, detail and note', () => {
    render(<MeterList aria-label="Stock" rows={rows} />);
    const list = screen.getByRole('list', { name: 'Stock' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Props 3m')).toBeInTheDocument();
    expect(within(items[0]).getByText('248 / 400')).toBeInTheDocument();
    expect(
      within(items[0]).getByText('18 damaged or lost in the last 12 months')
    ).toBeInTheDocument();
    expect(
      within(items[0]).getByRole('img', { name: 'At sites 248 of 400, In yard 152 of 400' })
    ).toBeInTheDocument();
    expect(within(items[1]).queryByText(/damaged/)).not.toBeInTheDocument();
  });

  it('shows one shared legend and a footnote', () => {
    render(
      <MeterList
        rows={rows}
        legend={[
          { tone: 'accent', label: 'At sites' },
          { tone: 'muted', label: 'In yard' },
        ]}
        footnote="₹12,000 in advances not shown"
      />
    );
    expect(screen.getByText('In yard')).toBeInTheDocument();
    expect(screen.getByText('₹12,000 in advances not shown')).toBeInTheDocument();
  });

  it('shows the empty line instead of rows', () => {
    render(
      <MeterList
        rows={[]}
        empty="Nothing outstanding"
        legend={[{ tone: 'accent', label: 'X' }]}
        footnote="₹500 in advances not shown"
      />
    );
    expect(screen.getByText('Nothing outstanding')).toBeInTheDocument();
    expect(screen.getByText('₹500 in advances not shown')).toBeInTheDocument();
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });
});

describe('MeterList CSS', () => {
  it('makes a linked label a 44px tap target on phones', async () => {
    const css = await readCss('src/components/ui/MeterList.module.css');
    const mobile = css.slice(css.indexOf('@media (max-width: 768px)'));
    expect(mobile).toMatch(/\.label > a\s*\{[^}]*display:\s*inline-flex[^}]*min-height:\s*44px/);
  });
});

describe('MeterLegend', () => {
  it('lists swatches with labels and optional values', () => {
    const { container } = render(
      <MeterLegend
        items={[
          { tone: 'danger', label: 'Lost', value: 1200 },
          { tone: 'info', label: 'On site' },
        ]}
      />
    );
    expect(screen.getByText('1,200')).toHaveClass('mono');
    expect(container.querySelector('.sw-danger')).not.toBeNull();
    expect(screen.getByText('On site')).toBeInTheDocument();
  });
});
