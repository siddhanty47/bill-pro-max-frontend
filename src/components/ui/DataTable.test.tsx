import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from './DataTable';

type Row = { id: string; party: string; amount?: number };
const rows: Row[] = [
  { id: 'a', party: 'Acme', amount: 100 },
  { id: 'b', party: 'Beta' },
];
const columns: Column<Row>[] = [
  { key: 'party', header: 'Party' },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    render: r => `Rs ${r.amount ?? 0}`,
  },
];

describe('DataTable', () => {
  it('renders headers and default cell values', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByRole('columnheader', { name: 'Party' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Acme' })).toBeInTheDocument();
  });

  it('uses custom render output and column flags', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={r => r.id} />);
    const cell = screen.getByRole('cell', { name: 'Rs 100' });
    expect(cell).toHaveClass('right', 'mono', 'hideOnMobile');
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass('hideOnMobile');
  });

  it('passes nowrap to headers and cells', () => {
    const cols: Column<Row>[] = [{ key: 'party', header: 'Party', nowrap: true }];
    render(<DataTable columns={cols} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByRole('columnheader', { name: 'Party' })).toHaveClass('nowrap');
    expect(screen.getByRole('cell', { name: 'Acme' })).toHaveClass('nowrap');
  });

  it('renders an empty string for missing values', () => {
    const cols: Column<Row>[] = [{ key: 'amount', header: 'Amount' }];
    render(<DataTable columns={cols} rows={[rows[1]]} rowKey={r => r.id} />);
    expect(screen.getAllByRole('cell')[0]).toHaveTextContent('');
  });

  it('fires onRowClick on click and Enter', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={r => r.id} onRowClick={onRowClick} />);
    await user.click(screen.getByRole('cell', { name: 'Acme' }));
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    screen.getAllByRole('row')[2].focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
  });

  it('shows the default empty state', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={r => r.id} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a custom empty node', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={r => r.id} empty={<p>No bills</p>} />);
    expect(screen.getByText('No bills')).toBeInTheDocument();
  });

  it('labels the table with aria-label', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={r => r.id} aria-label="Bills" />);
    expect(screen.getByRole('table', { name: 'Bills' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('does not render a phone list without a mobile spec', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} rowKey={r => r.id} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container.querySelector('.tableView')).toBeNull();
  });
});

describe('DataTable mobile list', () => {
  type Bill = {
    id: string;
    no: string;
    party: string;
    status: string;
    site?: string;
    due?: string;
  };
  const bills: Bill[] = [
    { id: '1', no: 'B-001', party: 'Mehta Builders', status: 'Paid', site: 'PLOT', due: '16 Nov' },
    { id: '2', no: 'B-002', party: 'Om Constructions', status: 'Draft' },
  ];
  const cols: Column<Bill>[] = [
    { key: 'no', header: 'Bill' },
    { key: 'party', header: 'Party' },
  ];
  const mobile = {
    title: (b: Bill) => b.no,
    leading: (b: Bill) => <span data-testid={`lead-${b.id}`} />,
    badge: (b: Bill) => <span>{b.status}</span>,
    subtitle: (b: Bill) => b.party,
    meta: (b: Bill) => [b.site, b.due, '3 items'],
    actions: (b: Bill) =>
      b.status === 'Draft' ? (
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
      ) : null,
  };
  const onConfirm = vi.fn();

  it('renders both the table and the phone list', () => {
    render(
      <DataTable
        columns={cols}
        rows={bills}
        rowKey={b => b.id}
        mobile={mobile}
        aria-label="Bills"
      />
    );
    expect(screen.getByRole('table', { name: 'Bills' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Bills' });
    expect(list).toHaveClass('list');
    expect(screen.getByRole('table').parentElement).toHaveClass('tableView');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows title, leading, badge, subtitle and meta joined with a middle dot', () => {
    render(<DataTable columns={cols} rows={bills} rowKey={b => b.id} mobile={mobile} />);
    const [first, second] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(within(first).getByText('B-001')).toHaveClass('title');
    expect(within(first).getByText('Paid').parentElement).toHaveClass('badge');
    expect(within(first).getByTestId('lead-1')).toBeInTheDocument();
    expect(within(first).getByText('Mehta Builders')).toHaveClass('subtitle');
    expect(within(first).getByText('PLOT · 16 Nov · 3 items')).toHaveClass('meta');
    // Empty meta parts are skipped, not joined as blank segments.
    expect(within(second).getByText('3 items')).toHaveClass('meta');
  });

  it('calls onRowClick when an item is tapped or activated with Enter', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={cols}
        rows={bills}
        rowKey={b => b.id}
        mobile={mobile}
        onRowClick={onRowClick}
      />
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveClass('clickable');
    expect(items[0]).toHaveAttribute('tabindex', '0');
    await user.click(within(items[0]).getByText('Mehta Builders'));
    expect(onRowClick).toHaveBeenLastCalledWith(bills[0]);
    items[1].focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(bills[1]);
    await user.keyboard('a');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire onRowClick from an action button', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    onConfirm.mockClear();
    render(
      <DataTable
        columns={cols}
        rows={bills}
        rowKey={b => b.id}
        mobile={mobile}
        onRowClick={onRowClick}
      />
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    const confirm = within(items[1]).getByRole('button', { name: 'Confirm' });
    expect(confirm.parentElement).toHaveClass('actions');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    confirm.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).not.toHaveBeenCalled();
    expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('places actions on the title line, after the badge, when actionsPlacement is trailing', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    onConfirm.mockClear();
    render(
      <DataTable
        columns={cols}
        rows={bills}
        rowKey={b => b.id}
        mobile={{ ...mobile, actionsPlacement: 'trailing' }}
        onRowClick={onRowClick}
      />
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    const confirm = within(items[1]).getByRole('button', { name: 'Confirm' });
    const line1 = items[1].querySelector('.line1') as HTMLElement;
    expect(line1).toContainElement(confirm);
    expect(items[1].querySelector('.actions')).toBeNull();
    const end = line1.querySelector('.end') as HTMLElement;
    expect(end.firstElementChild).toHaveClass('badge');
    expect(end.lastElementChild).toHaveClass('trailing');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('shows trailing actions without a badge, and nothing when there are none', () => {
    render(
      <DataTable
        columns={cols}
        rows={bills}
        rowKey={b => b.id}
        mobile={{
          title: b => b.no,
          actions: b => (b.status === 'Draft' ? <button type="button">Confirm</button> : null),
          actionsPlacement: 'trailing',
        }}
      />
    );
    const [first, second] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(first.querySelector('.end')).toBeNull();
    expect(second.querySelector('.end .badge')).toBeNull();
    expect(within(second).getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('renders only the title when the spec has nothing else, and items are inert without onRowClick', () => {
    render(
      <DataTable columns={cols} rows={bills} rowKey={b => b.id} mobile={{ title: b => b.no }} />
    );
    const [first] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(first).not.toHaveClass('clickable');
    expect(first).not.toHaveAttribute('tabindex');
    expect(first.querySelector('.line2')).toBeNull();
    expect(first.querySelector('.badge')).toBeNull();
    expect(first.querySelector('.actions')).toBeNull();
  });

  it('still shows the empty state instead of either view', () => {
    render(<DataTable columns={cols} rows={[]} rowKey={b => b.id} mobile={mobile} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });
});
