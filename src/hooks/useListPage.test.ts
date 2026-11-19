import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useListPage } from './useListPage';
import { useDebouncedValue } from './useDebouncedValue';

describe('useListPage', () => {
  it('starts on page 1 and moves with setPage', () => {
    const { result } = renderHook(() => useListPage('a', 100));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](3));
    expect(result.current[0]).toBe(3);
  });

  it('goes back to page 1 when the filters change', () => {
    const { result, rerender } = renderHook(({ key }) => useListPage(key, 100), {
      initialProps: { key: 'status=' },
    });
    act(() => result.current[1](4));
    rerender({ key: 'status=paid' });
    expect(result.current[0]).toBe(1);
  });

  it('steps back to the last page when the total shrinks', () => {
    const { result, rerender } = renderHook(({ total }) => useListPage('k', total), {
      initialProps: { total: 100 as number | undefined },
    });
    act(() => result.current[1](4));
    rerender({ total: undefined });
    expect(result.current[0]).toBe(4);
    rerender({ total: 51 });
    expect(result.current[0]).toBe(3);
    rerender({ total: 0 });
    expect(result.current[0]).toBe(1);
  });
});

describe('useDebouncedValue', () => {
  it('updates only after the value settles', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
        initialProps: { v: 'a' },
      });
      rerender({ v: 'ab' });
      act(() => vi.advanceTimersByTime(200));
      rerender({ v: 'abc' });
      act(() => vi.advanceTimersByTime(200));
      expect(result.current).toBe('a');
      act(() => vi.advanceTimersByTime(100));
      expect(result.current).toBe('abc');
    } finally {
      vi.useRealTimers();
    }
  });
});
