import { describe, it, expect } from 'vitest';
import { moveSelection, reconcileSelection } from './selection';
import type { SearchResult } from './searchEngine';

const r = (key: string): SearchResult => ({
  key,
  tag: 'PARTY',
  title: key,
  subtitle: '',
  href: '/',
  score: 1,
});
const [a, b, c] = ['a', 'b', 'c'].map(r);

describe('selection', () => {
  it('wraps forward and back', () => {
    expect(moveSelection([a, b, c], 'c', 1)).toBe('a');
    expect(moveSelection([a, b, c], 'a', -1)).toBe('c');
    expect(moveSelection([a, b, c], 'a', 1)).toBe('b');
  });
  it('starts at ends when nothing selected; null for empty', () => {
    expect(moveSelection([a, b, c], null, 1)).toBe('a');
    expect(moveSelection([a, b, c], null, -1)).toBe('c');
    expect(moveSelection([], 'a', 1)).toBeNull();
  });
  it('reconcile', () => {
    expect(reconcileSelection([r('doc'), a, b], 'a', false)).toBe('a');
    expect(reconcileSelection([r('x'), r('y')], 'a', true)).toBe('x');
    expect(reconcileSelection([r('x'), r('y')], 'a', false)).toBe('x');
    expect(reconcileSelection([], 'a', false)).toBeNull();
  });
});
