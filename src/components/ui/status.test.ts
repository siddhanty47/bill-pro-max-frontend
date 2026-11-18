import { describe, expect, it } from 'vitest';
import { statusLabel, statusTone } from './status';

describe('statusTone', () => {
  it.each([
    ['paid', 'success'],
    ['active', 'success'],
    ['confirmed', 'success'],
    ['completed', 'success'],
    ['sent', 'info'],
    ['delivery', 'info'],
    ['partial', 'warning'],
    ['pending', 'warning'],
    ['return', 'warning'],
    ['overdue', 'danger'],
    ['failed', 'danger'],
    ['cancelled', 'danger'],
    ['terminated', 'danger'],
    ['accepted', 'success'],
    ['present', 'success'],
    ['half-day', 'warning'],
    ['leave', 'warning'],
    ['declined', 'danger'],
    ['absent', 'danger'],
    ['revoked', 'danger'],
    ['suspended', 'danger'],
    ['draft', 'neutral'],
    ['constructor', 'neutral'],
    ['toString', 'neutral'],
    ['expired', 'neutral'],
    ['inactive', 'neutral'],
    ['Mystery', 'neutral'],
    [undefined, 'neutral'],
  ])('maps %s to %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it('is case-insensitive', () => {
    expect(statusTone('OVERDUE')).toBe('danger');
    expect(statusTone('Paid')).toBe('success');
  });
});

describe('statusLabel', () => {
  it('uses sentence case', () => {
    expect(statusLabel('OVERDUE')).toBe('Overdue');
    expect(statusLabel('overdue')).toBe('Overdue');
    expect(statusLabel('in_progress')).toBe('In progress');
  });

  it('handles an empty string', () => {
    expect(statusLabel('')).toBe('');
  });
});
