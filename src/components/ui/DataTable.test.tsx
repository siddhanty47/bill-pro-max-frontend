import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DataTable, type Column, type DataTableProps } from './DataTable';
import { DocNumber } from './DocNumber';
import type { ServerListSource } from '../../utils/recordNav';
import { RowActions } from './RowActions';

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

  it('colours a cell by its row tone', () => {
    const toned: Column<Row>[] = [
      { key: 'party', header: 'Party' },
      { key: 'amount', header: 'Amount', tone: r => (r.amount ? 'negative' : undefined) },
    ];
    render(<DataTable columns={toned} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByText('100').closest('td')).toHaveClass('tone-negative');
    expect(screen.getByText('Beta').closest('tr')?.querySelector('.tone-negative')).toBeNull();
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

  it('keeps meta in the body font; only an explicit mono span is mono', async () => {
    const css = await readCss('./DataTable.module.css');
    expect(css.match(/\.meta\s*\{[^}]*\}/)![0]).not.toMatch(/font-family/);
    const { container } = render(
      <DataTable
        aria-label="B"
        columns={[{ key: 'n', header: 'N', render: () => 'x' }]}
        rows={[{ id: '1' }]}
        rowKey={r => r.id}
        mobile={{
          title: () => 'T',
          meta: () => [
            'Due 1 Dec',
            <span key="a" className="mono">
              ₹10
            </span>,
          ],
        }}
      />
    );
    const meta = container.querySelector('.meta')!;
    expect(meta).not.toHaveClass('mono');
    expect(within(meta as HTMLElement).getByText('₹10')).toHaveClass('mono');
    expect(meta.querySelectorAll('.mono')).toHaveLength(1);
  });

  it('shows title, leading, badge, subtitle and meta joined with a middle dot', () => {
    render(<DataTable columns={cols} rows={bills} rowKey={b => b.id} mobile={mobile} />);
    const [first, second] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(within(first).getByText('B-001')).toHaveClass('title');
    expect(within(first).getByText('Paid').parentElement).toHaveClass('badge');
    expect(within(first).getByTestId('lead-1')).toBeInTheDocument();
    expect(within(first).getByText('Mehta Builders')).toHaveClass('subtitle');
    const meta = first.querySelector('.meta')!;
    expect(meta).toHaveTextContent('PLOT · 16 Nov · 3 items');
    // The middle dots are decoration: hidden from assistive tech.
    const dots = meta.querySelectorAll('[aria-hidden="true"]');
    expect(dots).toHaveLength(2);
    dots.forEach(d => expect(d).toHaveTextContent('·'));
    // Empty meta parts are skipped, not joined as blank segments.
    expect(within(second).getByText('3 items')).toHaveClass('meta');
  });

  it('activates an item with Space (and keeps the page from scrolling)', async () => {
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
    items[0].focus();
    await user.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledWith(bills[0]);
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    items[1].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    // Space inside an action button is the button's own business.
    onRowClick.mockClear();
    within(items[1]).getByRole('button', { name: 'Confirm' }).focus();
    await user.keyboard(' ');
    expect(onRowClick).not.toHaveBeenCalled();
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

describe('DataTable with RowActions in a clickable row', () => {
  const onDelete = vi.fn();
  const onRowClick = vi.fn();
  const actionCols: Column<Row>[] = [
    { key: 'party', header: 'Party' },
    {
      key: 'actions',
      header: 'Actions',
      render: () => <RowActions items={[{ label: 'Delete', onClick: onDelete }]} />,
    },
  ];

  it('choosing a menu item in the table does not call onRowClick', async () => {
    const user = userEvent.setup();
    onDelete.mockClear();
    onRowClick.mockClear();
    render(
      <DataTable columns={actionCols} rows={[rows[0]]} rowKey={r => r.id} onRowClick={onRowClick} />
    );
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('choosing a menu item in the phone list does not call onRowClick', async () => {
    const user = userEvent.setup();
    onDelete.mockClear();
    onRowClick.mockClear();
    render(
      <DataTable
        columns={actionCols}
        rows={[rows[0]]}
        rowKey={r => r.id}
        onRowClick={onRowClick}
        mobile={{
          title: r => r.party,
          actions: () => <RowActions items={[{ label: 'Delete', onClick: onDelete }]} />,
        }}
      />
    );
    const list = screen.getByRole('list');
    await user.click(within(list).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

// vitest hands CSS modules back as class maps, so read the stylesheet source.
async function readCss(file: string) {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
    readFileSync(path: URL, encoding: 'utf8'): string;
  };
  return fs.readFileSync(new URL(file, import.meta.url), 'utf8');
}

const rule = (css: string, selector: string) =>
  css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('DataTable phone list hierarchy', () => {
  it('makes the title the most prominent line and the subtitle secondary', async () => {
    const css = await readCss('./DataTable.module.css');
    const weight = (block: string) => Number(block.match(/font-weight:\s*(\d+)/)?.[1] ?? 400);
    const title = rule(css, '.title');
    const subtitle = rule(css, '.subtitle');
    expect(weight(title)).toBeGreaterThan(weight(subtitle));
    expect(title).toMatch(/color:\s*var\(--text-heading\)/);
    expect(subtitle).not.toMatch(/--text-heading/);
  });
});

describe('DataTable paging', () => {
  const many = (n: number, prefix = 'P'): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, party: `${prefix}${i + 1}` }));
  const bodyRows = () => screen.getAllByRole('row').slice(1);

  it('shows no pager when rows fit on one page', () => {
    render(<DataTable columns={columns} rows={many(25)} rowKey={r => r.id} aria-label="Parties" />);
    expect(bodyRows()).toHaveLength(25);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('pages its own rows 25 at a time', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={many(30)} rowKey={r => r.id} aria-label="Parties" />);

    expect(bodyRows()).toHaveLength(25);
    const nav = screen.getByRole('navigation', { name: 'Parties pages' });
    expect(nav).toHaveTextContent('Showing 1–25 of 30');

    await user.click(within(nav).getByRole('button', { name: /Next/ }));
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByRole('cell', { name: 'P26' })).toBeInTheDocument();
    expect(nav).toHaveTextContent('Showing 26–30 of 30');
  });

  it('honours a custom page size and goes back to page 1 when rows change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DataTable columns={columns} rows={many(12)} rowKey={r => r.id} pageSize={5} />
    );
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(bodyRows()).toHaveLength(2);

    rerender(<DataTable columns={columns} rows={many(12, 'Q')} rowKey={r => r.id} pageSize={5} />);
    expect(screen.getByRole('cell', { name: 'Q1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('pages the phone list the same way', () => {
    render(
      <DataTable
        columns={columns}
        rows={many(30)}
        rowKey={r => r.id}
        aria-label="Parties"
        mobile={{ title: r => r.party }}
      />
    );
    const list = screen.getByRole('list', { name: 'Parties' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(25);
  });

  it('server mode shows the given rows unsliced with the backend total', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        rows={many(25)}
        rowKey={r => r.id}
        aria-label="Challans"
        pagination={{ page: 2, pageSize: 25, total: 132, onPageChange }}
      />
    );

    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByRole('navigation', { name: 'Challans pages' })).toHaveTextContent(
      'Showing 26–50 of 132'
    );
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe('DataTable rowLink', () => {
  type R = { id: string; name: string };
  const many: R[] = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i + 1}`,
    name: `Name ${i + 1}`,
  }));
  const link = (r: R) => `/things/${r.id}`;
  const cols: Column<R>[] = [{ key: 'name', header: 'Name' }];
  const source: ServerListSource = { list: 'bills', args: { businessId: 'b1', pageSize: 25 } };

  function Probe() {
    const loc = useLocation();
    return (
      <div data-testid="loc">
        {loc.pathname}|{JSON.stringify(loc.state)}
      </div>
    );
  }
  function setup(ui: ReactElement) {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route path="/list" element={ui} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    );
  }
  const read = () => {
    const [path, json] = screen.getByTestId('loc').textContent!.split('|');
    return { path, state: JSON.parse(json) };
  };

  it('row click navigates with the whole client list', async () => {
    const user = userEvent.setup();
    setup(<DataTable columns={cols} rows={many} rowKey={r => r.id} rowLink={link} />);
    await user.click(screen.getByRole('cell', { name: 'Name 2' }));
    const { path, state } = read();
    expect(path).toBe('/things/r2');
    expect(state.recordNav.paths).toHaveLength(30);
    expect(state.recordNav.index).toBe(1);
  });

  it('index accounts for the client page', async () => {
    const user = userEvent.setup();
    setup(<DataTable columns={cols} rows={many} rowKey={r => r.id} rowLink={link} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('cell', { name: 'Name 26' }));
    expect(read().state.recordNav.index).toBe(25);
  });

  it('Enter on a row navigates', async () => {
    const user = userEvent.setup();
    setup(<DataTable columns={cols} rows={many} rowKey={r => r.id} rowLink={link} />);
    screen.getAllByRole('row')[1].focus();
    await user.keyboard('{Enter}');
    expect(read().path).toBe('/things/r1');
  });

  it('DocNumber to the row path carries state; other paths do not', async () => {
    const user = userEvent.setup();
    const c: Column<R>[] = [
      { key: 'a', header: 'A', render: r => <DocNumber value={`own-${r.id}`} to={link(r)} /> },
      { key: 'b', header: 'B', render: r => <DocNumber value={`party-${r.id}`} to="/parties/p" /> },
    ];
    setup(<DataTable columns={c} rows={many} rowKey={r => r.id} rowLink={link} />);
    await user.click(screen.getByRole('link', { name: 'own-r3' }));
    expect(read().state.recordNav.index).toBe(2);
  });

  it('DocNumber to a different path carries none', async () => {
    const user = userEvent.setup();
    const c: Column<R>[] = [
      { key: 'b', header: 'B', render: r => <DocNumber value={`party-${r.id}`} to="/parties/p" /> },
    ];
    setup(<DataTable columns={c} rows={many} rowKey={r => r.id} rowLink={link} />);
    await user.click(screen.getByRole('link', { name: 'party-r3' }));
    expect(read()).toEqual({ path: '/parties/p', state: null });
  });

  it('server mode with navSource carries page, total and source', async () => {
    const user = userEvent.setup();
    const page = many.slice(0, 25);
    setup(
      <DataTable
        columns={cols}
        rows={page}
        rowKey={r => r.id}
        rowLink={link}
        pagination={{ page: 2, pageSize: 25, total: 60, onPageChange: () => {}, navSource: source }}
      />
    );
    await user.click(screen.getByRole('cell', { name: 'Name 3' }));
    const { state } = read();
    expect(state.recordNav.paths).toHaveLength(25);
    expect(state.recordNav.index).toBe(2);
    expect(state.recordNav.server).toEqual({ source, page: 2, total: 60 });
  });

  it('server mode without navSource has no server field', async () => {
    const user = userEvent.setup();
    setup(
      <DataTable
        columns={cols}
        rows={many.slice(0, 25)}
        rowKey={r => r.id}
        rowLink={link}
        pagination={{ page: 1, pageSize: 25, total: 60, onPageChange: () => {} }}
      />
    );
    await user.click(screen.getByRole('cell', { name: 'Name 1' }));
    expect(read().state.recordNav.server).toBeUndefined();
  });

  it('phone list item carries the same state', async () => {
    const user = userEvent.setup();
    setup(
      <DataTable
        columns={cols}
        rows={many}
        rowKey={r => r.id}
        rowLink={link}
        mobile={{ title: r => `Title ${r.name}` }}
      />
    );
    await user.click(screen.getByText('Title Name 4'));
    const { path, state } = read();
    expect(path).toBe('/things/r4');
    expect(state.recordNav.index).toBe(3);
    expect(state.recordNav.paths).toHaveLength(30);
  });

  it('rowLink overrides onRowClick', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    setup(
      <DataTable
        columns={cols}
        rows={many}
        rowKey={r => r.id}
        rowLink={link}
        onRowClick={onRowClick}
      />
    );
    await user.click(screen.getByRole('cell', { name: 'Name 1' }));
    expect(onRowClick).not.toHaveBeenCalled();
    expect(read().path).toBe('/things/r1');
  });
});

describe('DataTable selection', () => {
  type S = { id: string; no: string; locked?: boolean };
  const items: S[] = [
    { id: 's1', no: 'INV-1' },
    { id: 's2', no: 'INV-2' },
    { id: 's3', no: 'INV-3', locked: true },
  ];
  const cols: Column<S>[] = [{ key: 'no', header: 'Bill' }];
  const label = (r: S) => `Select ${r.no}`;

  /** Controlled harness: keeps the selection in state and reports every change. */
  function Harness({
    rows = items,
    initial = [],
    spy,
    ...rest
  }: {
    rows?: S[];
    initial?: string[];
    spy?: (next: Set<string>) => void;
  } & Partial<DataTableProps<S>>) {
    const [selected, setSelected] = useState<Set<string>>(new Set(initial));
    return (
      <DataTable
        aria-label="Bills"
        columns={cols}
        rows={rows}
        rowKey={r => r.id}
        selection={{
          selected,
          onChange: next => {
            spy?.(next);
            setSelected(next);
          },
          isSelectable: r => !r.locked,
          label,
        }}
        {...rest}
      />
    );
  }
  const table = () => screen.getByRole('table', { name: 'Bills' });
  const header = () => within(table()).getByRole('checkbox', { name: 'Select all on this page' });

  it('adds a checkbox column and only selectable rows get a checkbox', () => {
    render(<Harness />);
    expect(within(table()).getByRole('checkbox', { name: 'Select INV-1' })).not.toBeChecked();
    expect(within(table()).getByRole('checkbox', { name: 'Select INV-2' })).toBeInTheDocument();
    expect(
      within(table()).queryByRole('checkbox', { name: 'Select INV-3' })
    ).not.toBeInTheDocument();
    expect(within(table()).getAllByRole('columnheader')).toHaveLength(2);
  });

  it('toggles a row and marks it selected', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const box = within(table()).getByRole('checkbox', { name: 'Select INV-1' });
    await user.click(box);
    expect(spy).toHaveBeenLastCalledWith(new Set(['s1']));
    expect(box).toBeChecked();
    const row = box.closest('tr')!;
    expect(row).toHaveClass('selected');
    expect(row).toHaveAttribute('data-selected', 'true');
    await user.click(box);
    expect(spy).toHaveBeenLastCalledWith(new Set());
    expect(row).not.toHaveClass('selected');
  });

  it('header selects every selectable row, shows a partial state, then clears', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(header()).not.toBeChecked();
    expect(header()).not.toBePartiallyChecked();

    await user.click(within(table()).getByRole('checkbox', { name: 'Select INV-2' }));
    expect(header()).toBePartiallyChecked();

    await user.click(header());
    expect(spy).toHaveBeenLastCalledWith(new Set(['s2', 's1']));
    expect(header()).toBeChecked();
    expect(header()).not.toBePartiallyChecked();

    await user.click(header());
    expect(spy).toHaveBeenLastCalledWith(new Set());
    expect(header()).not.toBeChecked();
  });

  it('header acts on the current page only and keeps keys from other pages', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const many: S[] = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, no: `N-${i}` }));
    render(<Harness rows={many} initial={['elsewhere']} pageSize={2} spy={spy} />);
    await user.click(header());
    expect(spy).toHaveBeenLastCalledWith(new Set(['elsewhere', 'p0', 'p1']));
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(header()).not.toBeChecked();
    await user.click(header());
    expect(spy).toHaveBeenLastCalledWith(new Set(['elsewhere', 'p0', 'p1', 'p2', 'p3']));
    await user.click(header());
    expect(spy).toHaveBeenLastCalledWith(new Set(['elsewhere', 'p0', 'p1']));
  });

  it('disables the header when no row on the page can be selected', () => {
    render(<Harness rows={[items[2]]} />);
    expect(header()).toBeDisabled();
  });

  it('defaults to every row selectable with a generic label', () => {
    render(
      <DataTable
        columns={cols}
        rows={items}
        rowKey={r => r.id}
        selection={{ selected: new Set(['s3']), onChange: () => {} }}
      />
    );
    const boxes = screen.getAllByRole('checkbox', { name: 'Select row' });
    expect(boxes).toHaveLength(3);
    expect(boxes[2]).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Select all on this page' })
    ).toBePartiallyChecked();
  });

  it('a checkbox click (or a near miss in its cell) never fires onRowClick', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Harness onRowClick={onRowClick} />);
    const box = within(table()).getByRole('checkbox', { name: 'Select INV-1' });
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box.closest('td')!);
    expect(box).not.toBeChecked();
    expect(onRowClick).not.toHaveBeenCalled();
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
    expect(onRowClick).not.toHaveBeenCalled();
    await user.click(within(table()).getByRole('cell', { name: 'INV-2' }));
    expect(onRowClick).toHaveBeenCalledWith(items[1]);
  });

  it('a checkbox click on a rowLink row does not navigate, on desktop or phone', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route
            path="/list"
            element={
              <Harness
                rowLink={r => `/bills/${r.id}`}
                mobile={{ title: r => r.no, actions: () => <button type="button">Send</button> }}
              />
            }
          />
          <Route path="*" element={<p>Opened</p>} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(within(table()).getByRole('checkbox', { name: 'Select INV-1' }));
    const list = screen.getByRole('list', { name: 'Bills' });
    const phoneBox = within(list).getByRole('checkbox', { name: 'Select INV-2' });
    await user.click(phoneBox);
    await user.click(phoneBox.closest('label')!);
    expect(screen.queryByText('Opened')).not.toBeInTheDocument();
    expect(within(table()).getByRole('checkbox', { name: 'Select INV-1' })).toBeChecked();
    // The phone list shares the selection with the table.
    expect(within(list).getByRole('checkbox', { name: 'Select INV-1' })).toBeChecked();
    expect(phoneBox).not.toBeChecked();
    await user.click(within(list).getByText('INV-2'));
    expect(screen.getByText('Opened')).toBeInTheDocument();
  });

  it('gives phone-list items a leading checkbox and marks selected items', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['s2']} mobile={{ title: r => r.no, subtitle: () => 'Party' }} />);
    const [first, second, third] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(first).toHaveClass('withSelect');
    const slot = first.firstElementChild!;
    expect(slot).toHaveClass('selectSlot');
    expect(slot.querySelector('label')).toHaveClass('selectHit');
    expect(first.querySelector('.body .line1')).toHaveTextContent('INV-1');
    expect(first.querySelector('.body .line2')).toHaveTextContent('Party');
    expect(second).toHaveClass('selected');
    expect(second).toHaveAttribute('data-selected', 'true');
    expect(within(third).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(first).getByRole('checkbox', { name: 'Select INV-1' }));
    expect(first).toHaveClass('selected');
  });

  it('keeps the phone hit area at 44px', async () => {
    const css = await readCss('./DataTable.module.css');
    expect(rule(css, '.selectSlot .selectHit')).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/\.selectCell \.selectHit\s*\{[^}]*min-height:\s*44px/);
  });

  it('renders exactly as before without selection', () => {
    render(
      <DataTable
        columns={cols}
        rows={items}
        rowKey={r => r.id}
        mobile={{ title: r => r.no }}
        aria-label="Bills"
      />
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const [first] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(first.firstElementChild).toHaveClass('line1');
    expect(first).not.toHaveAttribute('data-selected');
    expect(screen.getAllByRole('row')[1]).not.toHaveAttribute('data-selected');
  });
});
