import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { Table, THead, TBody, Tr, Th, Td } from './Table';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  hideOnMobile?: boolean;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: DataTableProps<T>) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <Table>
      <THead>
        <Tr>
          {columns.map(c => (
            <Th key={c.key} align={c.align} hideOnMobile={c.hideOnMobile}>
              {c.header}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {rows.map(row => (
          <Tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {columns.map(c => (
              <Td key={c.key} align={c.align} mono={c.mono} hideOnMobile={c.hideOnMobile}>
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
              </Td>
            ))}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
