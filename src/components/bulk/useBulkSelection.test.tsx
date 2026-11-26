import { describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBulkSelection, type BulkSelectionOptions } from './useBulkSelection';

type Row = { id: string; name: string; locked?: boolean };
const rows: Row[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C', locked: true },
];
const base: BulkSelectionOptions<Row> = { rows, rowKey: r => r.id, resetKey: 'p1' };

const setup = (opts: Partial<BulkSelectionOptions<Row>> = {}) =>
  renderHook((props: BulkSelectionOptions<Row>) => useBulkSelection(props), {
    initialProps: { ...base, ...opts },
  });

describe('useBulkSelection', () => {
  it('starts empty and maps selected keys to rows in table order', () => {
    const { result } = setup();
    expect(result.current.selectedRows).toEqual([]);
    act(() => result.current.setSelected(new Set(['c', 'a'])));
    expect(result.current.selectedRows.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('ignores selected keys that are not on this page', () => {
    const { result } = setup();
    act(() => result.current.setSelected(new Set(['a', 'zzz'])));
    expect(result.current.selectedRows.map(r => r.id)).toEqual(['a']);
    expect(result.current.selected.size).toBe(2);
  });

  it('removes keys and clears', () => {
    const { result } = setup();
    act(() => result.current.setSelected(new Set(['a', 'b', 'c'])));
    act(() => result.current.remove(['a', 'c']));
    expect([...result.current.selected]).toEqual(['b']);
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });

  it('clears when the reset key changes, and keeps the selection otherwise', () => {
    const { result, rerender } = setup();
    act(() => result.current.setSelected(new Set(['a'])));
    rerender({ ...base });
    expect(result.current.selected.size).toBe(1);
    rerender({ ...base, resetKey: 'p2' });
    expect(result.current.selected.size).toBe(0);
  });

  it('builds the DataTable selection prop', () => {
    const label = (r: Row) => `Select ${r.name}`;
    const isSelectable = (r: Row) => !r.locked;
    const { result } = setup({ label, isSelectable });
    const prop = result.current.selectionProp;
    expect(prop.label).toBe(label);
    expect(prop.isSelectable).toBe(isSelectable);
    act(() => prop.onChange(new Set(['b'])));
    expect([...result.current.selectionProp.selected]).toEqual(['b']);
  });

  it('phone button selects every selectable row, then clears', async () => {
    const user = userEvent.setup();
    function Harness() {
      const s = useBulkSelection({ ...base, isSelectable: r => !r.locked });
      return (
        <>
          {s.mobileSelectAll}
          <output>{[...s.selected].sort().join(',')}</output>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Select all on this page' }));
    expect(screen.getByRole('status')).toHaveTextContent('a,b');
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Select all on this page' })).toBeInTheDocument();
  });

  it('has no phone button when nothing can be selected', () => {
    const { result } = setup({ rows: [] });
    expect(result.current.mobileSelectAll).toBeNull();
    const { result: locked } = setup({ isSelectable: () => false });
    expect(locked.current.mobileSelectAll).toBeNull();
  });
});
