import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, THead, TBody, Tr, Th, Td } from './Table';

function renderTable(onClick?: () => void) {
  return render(
    <Table className="extra">
      <THead>
        <Tr>
          <Th>Name</Th>
          <Th align="right" hideOnMobile>
            Amount
          </Th>
        </Tr>
      </THead>
      <TBody>
        <Tr onClick={onClick}>
          <Td mono>INV-1</Td>
          <Td align="right" hideOnMobile>
            10
          </Td>
        </Tr>
      </TBody>
    </Table>
  );
}

describe('Table primitives', () => {
  it('renders a table inside a wrapper and applies className', () => {
    const { container } = renderTable();
    expect(container.firstChild).toHaveClass('wrap', 'extra');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass('right');
  });

  it('applies mono, right and hideOnMobile classes to cells', () => {
    renderTable();
    expect(screen.getByRole('cell', { name: 'INV-1' })).toHaveClass('mono');
    expect(screen.getByRole('cell', { name: '10' })).toHaveClass('right', 'hideOnMobile');
  });

  it('applies the nowrap class to cells and headers', () => {
    render(
      <Table>
        <THead>
          <Tr>
            <Th nowrap>Head</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td nowrap>Cell</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole('columnheader')).toHaveClass('nowrap');
    expect(screen.getByRole('cell')).toHaveClass('nowrap');
  });

  it('marks stackOnMobile rows (clickable or not) and keeps their className', () => {
    render(
      <Table>
        <TBody>
          <Tr stackOnMobile className="row">
            <Td>A</Td>
          </Tr>
          <Tr stackOnMobile onClick={() => {}}>
            <Td>B</Td>
          </Tr>
          <Tr>
            <Td>C</Td>
          </Tr>
        </TBody>
      </Table>
    );
    const [a, b, c] = screen.getAllByRole('row');
    expect(a).toHaveClass('stack', 'row');
    expect(b).toHaveClass('stack', 'clickable');
    expect(c).not.toHaveAttribute('class');
  });

  it('keeps non-clickable rows out of the tab order', () => {
    renderTable();
    const row = screen.getAllByRole('row')[1];
    expect(row).not.toHaveAttribute('tabindex');
    expect(row).not.toHaveClass('clickable');
  });

  it('makes clickable rows focusable and activates on click and Enter', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderTable(onClick);
    const row = screen.getAllByRole('row')[1];
    expect(row).toHaveClass('clickable');
    expect(row).toHaveAttribute('tabindex', '0');
    await user.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
    row.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
    await user.keyboard('a');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('ignores clicks on interactive children but still runs their handler', async () => {
    const user = userEvent.setup();
    const onRow = vi.fn();
    const onBtn = vi.fn();
    render(
      <Table>
        <TBody>
          <Tr onClick={onRow}>
            <Td>
              <button type="button" onClick={onBtn}>
                Edit
              </button>
              <span>plain</span>
            </Td>
          </Tr>
        </TBody>
      </Table>
    );
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onBtn).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
    await user.click(screen.getByText('plain'));
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it('forwards native attributes and merges className', () => {
    render(
      <Table>
        <THead>
          <Tr className="r" data-x="1" aria-selected="true">
            <Th scope="col" colSpan={2} className="h" align="center">
              H
            </Th>
          </Tr>
        </THead>
        <TBody>
          <Tr onClick={() => {}} className="r2" id="row" onKeyDown={() => {}}>
            <Td title="t" className="c">
              x
            </Td>
          </Tr>
        </TBody>
      </Table>
    );
    const th = screen.getByRole('columnheader');
    expect(th).toHaveClass('h', 'center');
    expect(th).toHaveAttribute('colspan', '2');
    expect(th).toHaveAttribute('scope', 'col');
    expect(screen.getAllByRole('row')[0]).toHaveAttribute('data-x', '1');
    expect(screen.getAllByRole('row')[0]).toHaveClass('r');
    expect(screen.getByRole('cell')).toHaveAttribute('title', 't');
    expect(screen.getAllByRole('row')[1]).toHaveClass('clickable', 'r2');
    expect(screen.getAllByRole('row')[1]).toHaveAttribute('id', 'row');
  });

  it('accepts an aria-label and a visually hidden caption', () => {
    const { rerender } = render(
      <Table aria-label="Bills">
        <TBody>
          <Tr>
            <Td>x</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole('table', { name: 'Bills' })).toBeInTheDocument();
    rerender(
      <Table caption="Recent bills">
        <TBody>
          <Tr>
            <Td>x</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole('table', { name: 'Recent bills' })).toBeInTheDocument();
    expect(screen.getByText('Recent bills')).toHaveClass('caption');
  });

  it('applies dense padding and the total row variant', () => {
    render(
      <Table dense aria-label="Statement">
        <TBody>
          <Tr variant="total">
            <Td>Totals</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole('table', { name: 'Statement' })).toHaveClass('dense');
    expect(screen.getByText('Totals').closest('tr')).toHaveClass('total');
  });
});

describe('Table detail padding and value tones', () => {
  it('applies the detail class and colours cells by tone', () => {
    render(
      <Table detail aria-label="Summary">
        <THead>
          <Tr>
            <Th tone="warning">Head</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td tone="negative">₹500</Td>
            <Td tone="positive">₹0</Td>
            <Td>plain</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole('table', { name: 'Summary' })).toHaveClass('detail');
    expect(screen.getByText('Head')).toHaveClass('tone-warning');
    expect(screen.getByText('₹500')).toHaveClass('tone-negative');
    expect(screen.getByText('₹0')).toHaveClass('tone-positive');
    expect(screen.getByText('plain')).not.toHaveAttribute('class');
  });
});

describe('signTone', () => {
  it('maps the sign of a number to a value tone', async () => {
    const { signTone } = await import('./status');
    expect(signTone(5)).toBe('positive');
    expect(signTone(-5)).toBe('negative');
    expect(signTone(0)).toBeUndefined();
    expect(signTone(0.1 + 0.2 - 0.3)).toBeUndefined();
    expect(signTone(-0.001)).toBeUndefined();
  });
});
