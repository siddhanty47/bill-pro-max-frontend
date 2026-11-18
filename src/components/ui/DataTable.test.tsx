import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
