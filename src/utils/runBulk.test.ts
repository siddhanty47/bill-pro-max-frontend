import { describe, expect, it } from 'vitest';
import { runBulk } from './runBulk';

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

describe('runBulk', () => {
  it('returns one result per item in input order, even when later items finish first', async () => {
    const delays = [30, 5, 15, 0];
    const results = await runBulk(delays, ms => tick(ms));
    expect(results.map(r => r.item)).toEqual(delays);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('keeps at most 3 calls in flight by default', async () => {
    let inFlight = 0;
    let max = 0;
    await runBulk(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        inFlight++;
        max = Math.max(max, inFlight);
        await tick(1);
        inFlight--;
      }
    );
    expect(max).toBe(3);
  });

  it('honours a custom concurrency', async () => {
    let inFlight = 0;
    let max = 0;
    const seen: number[] = [];
    await runBulk(
      [1, 2, 3, 4, 5],
      async n => {
        inFlight++;
        max = Math.max(max, inFlight);
        await tick(1);
        seen.push(n);
        inFlight--;
      },
      { concurrency: 2 }
    );
    expect(max).toBe(2);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('treats a concurrency below 1 as 1', async () => {
    let inFlight = 0;
    let max = 0;
    await runBulk(
      [1, 2, 3],
      async () => {
        inFlight++;
        max = Math.max(max, inFlight);
        await tick(1);
        inFlight--;
      },
      { concurrency: 0 }
    );
    expect(max).toBe(1);
  });

  it('captures failures without stopping the other items', async () => {
    const boom = new Error('boom');
    const results = await runBulk(['a', 'b', 'c', 'd'], async item => {
      if (item === 'b') throw boom;
      if (item === 'c') return Promise.reject('nope');
      return item;
    });
    expect(results).toEqual([
      { item: 'a', ok: true },
      { item: 'b', ok: false, error: boom },
      { item: 'c', ok: false, error: 'nope' },
      { item: 'd', ok: true },
    ]);
  });

  it('captures a synchronous throw', async () => {
    const results = await runBulk([1], () => {
      throw new Error('sync');
    });
    expect(results[0]).toMatchObject({ ok: false, error: new Error('sync') });
  });

  it('resolves to an empty list for no items', async () => {
    await expect(runBulk([], () => Promise.resolve())).resolves.toEqual([]);
  });
});
