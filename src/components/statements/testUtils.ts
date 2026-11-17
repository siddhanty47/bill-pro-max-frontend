import { screen } from '@testing-library/react';

/** Text of every cell, row by row, of the (single) table on screen. */
export function tableRows(index = 0): string[][] {
  const table = screen.getAllByRole('table')[index];
  return Array.from(table.querySelectorAll('tr')).map(tr =>
    Array.from(tr.querySelectorAll('th,td')).map(c => c.textContent ?? '')
  );
}
