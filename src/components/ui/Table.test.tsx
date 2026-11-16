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
    await user.keyboard('a');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
