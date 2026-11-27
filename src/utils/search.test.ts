import { describe, expect, it } from 'vitest';
import { matchesSearch } from './search';

describe('matchesSearch', () => {
  it('matches everything on an empty or blank term', () => {
    expect(matchesSearch('', ['a'])).toBe(true);
    expect(matchesSearch('   ', [])).toBe(true);
  });

  it('matches any value, case-insensitively, after trimming the term', () => {
    expect(matchesSearch(' meht ', ['Patel', 'MEHTA'])).toBe(true);
    expect(matchesSearch('xyz', ['Patel', 'Mehta'])).toBe(false);
  });

  it('skips missing values', () => {
    expect(matchesSearch('a', [undefined, null])).toBe(false);
    expect(matchesSearch('09ab', [undefined, '09ABCDE1234F1Z5'])).toBe(true);
  });
});
