import { describe, it, expect } from 'vitest';
import { highlightParts } from './highlight';

describe('highlightParts', () => {
  it('marks case-insensitive matches', () => {
    expect(highlightParts('Sharma Traders', 'shar')).toEqual([
      { text: 'Shar', match: true },
      { text: 'ma Traders', match: false },
    ]);
  });
  it('handles multiple tokens and separators in the query', () => {
    expect(highlightParts('MG Road Site', 'mg-site')).toEqual([
      { text: 'MG', match: true },
      { text: ' Road ', match: false },
      { text: 'Site', match: true },
    ]);
  });
  it('merges overlapping and adjacent matches', () => {
    expect(highlightParts('D-2025-26-0042', '0042 42')).toEqual([
      { text: 'D-2025-26-', match: false },
      { text: '0042', match: true },
    ]);
  });
  it('marks every occurrence', () => {
    expect(highlightParts('abab', 'ab')).toEqual([{ text: 'abab', match: true }]);
  });
  it('returns the whole text unmarked for empty query or no match', () => {
    expect(highlightParts('Sharma', '  ')).toEqual([{ text: 'Sharma', match: false }]);
    expect(highlightParts('Sharma', 'xyz')).toEqual([{ text: 'Sharma', match: false }]);
  });
  it('returns [] for empty text', () => {
    expect(highlightParts('', 'a')).toEqual([]);
  });
});
