import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRangePreset } from './useRangePreset';
import type { RangeKey } from '../types';

const PRESETS: RangeKey[] = ['3M', '6M', '1Y'];

describe('useRangePreset', () => {
  it('returns the fallback when nothing is stored', () => {
    const { result } = renderHook(() => useRangePreset('billing', PRESETS, '1Y'));
    expect(result.current[0]).toBe('1Y');
  });

  it('returns the stored value when it is one of the presets', () => {
    localStorage.setItem('dash.range.billing', '3M');
    const { result } = renderHook(() => useRangePreset('billing', PRESETS, '1Y'));
    expect(result.current[0]).toBe('3M');
  });

  it('ignores a stored value that is not in presets', () => {
    localStorage.setItem('dash.range.billing', '3Y');
    const { result } = renderHook(() => useRangePreset('billing', PRESETS, '1Y'));
    expect(result.current[0]).toBe('1Y');
  });

  it('returns the fallback when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useRangePreset('billing', PRESETS, '6M'));
    expect(result.current[0]).toBe('6M');
  });

  it('persists a new range under dash.range.<chartId> and survives a failing write', () => {
    const { result } = renderHook(() => useRangePreset('billing', PRESETS, '1Y'));
    act(() => result.current[1]('6M'));
    expect(result.current[0]).toBe('6M');
    expect(localStorage.getItem('dash.range.billing')).toBe('6M');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    act(() => result.current[1]('3M'));
    expect(result.current[0]).toBe('3M');
  });
});
