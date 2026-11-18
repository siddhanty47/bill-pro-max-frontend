import { describe, expect, it } from 'vitest';
import { optionalNumber } from './optionalNumber';

describe('optionalNumber', () => {
  it('turns an empty input into undefined', () => {
    expect(optionalNumber('')).toBeUndefined();
    expect(optionalNumber(null)).toBeUndefined();
    expect(optionalNumber(undefined)).toBeUndefined();
    expect(optionalNumber('abc')).toBeUndefined();
  });

  it('parses filled values like valueAsNumber', () => {
    expect(optionalNumber('500')).toBe(500);
    expect(optionalNumber('0')).toBe(0);
    expect(optionalNumber('12.5')).toBe(12.5);
    expect(optionalNumber(7)).toBe(7);
  });
});
