import { describe, expect, it } from 'vitest';
import { downloadPdfs, plural, splitResults, PDF_CONCURRENCY } from './bulkRun';

describe('plural', () => {
  it('picks one for 1 and many otherwise', () => {
    expect(plural(1, 'bill', 'bills')).toBe('bill');
    expect(plural(0, 'bill', 'bills')).toBe('bills');
    expect(plural(2, 'bill', 'bills')).toBe('bills');
  });
});

describe('splitResults', () => {
  it('splits done keys from skips with a reason', () => {
    const out = splitResults(
      [
        { item: { id: 'a' }, ok: true },
        { item: { id: 'b' }, ok: false, error: new Error('nope') },
      ],
      r => r.id,
      e => (e as Error).message
    );
    expect(out).toEqual({ done: ['a'], skipped: [{ row: { id: 'b' }, reason: 'nope' }] });
  });
});

describe('downloadPdfs', () => {
  it(`downloads ${PDF_CONCURRENCY} at a time and never rejects`, async () => {
    let inFlight = 0;
    let peak = 0;
    const download = async (n: number) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 1));
      inFlight--;
      if (n === 3) throw new Error('No PDF');
    };
    const out = await downloadPdfs([1, 2, 3, 4, 5], download, String, e => (e as Error).message);
    expect(peak).toBe(2);
    expect(out.done).toEqual(['1', '2', '4', '5']);
    expect(out.skipped).toEqual([{ row: 3, reason: 'No PDF' }]);
  });
});
