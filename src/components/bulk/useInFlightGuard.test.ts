import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInFlightGuard } from './useInFlightGuard';

describe('useInFlightGuard', () => {
  it('ignores calls while a run is going, across wrapped functions', async () => {
    const { result } = renderHook(() => useInFlightGuard());
    let release!: () => void;
    const seen: number[] = [];
    const slow = vi.fn((n: number) => {
      seen.push(n);
      return new Promise<void>(r => (release = r));
    });
    const other = vi.fn(async () => {});
    const runSlow = result.current(slow);
    const runOther = result.current(other);

    const first = runSlow(1);
    await runSlow(2);
    await runOther();
    expect(slow).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([1]);
    expect(other).not.toHaveBeenCalled();

    release();
    await first;
    await runOther();
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('frees the guard when a run throws', async () => {
    const { result } = renderHook(() => useInFlightGuard());
    const failing = result.current(async () => {
      throw new Error('boom');
    });
    await expect(failing()).rejects.toThrow('boom');
    const ok = vi.fn(async () => {});
    await result.current(ok)();
    expect(ok).toHaveBeenCalled();
  });
});
