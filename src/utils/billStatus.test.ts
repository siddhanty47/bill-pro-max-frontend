import { describe, expect, it } from 'vitest';
import { canChangeStatus, isIssued } from './billStatus';
import type { Bill } from '../types';

type BillStatus = Bill['status'];
const ALL: BillStatus[] = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];
const targets = (from: BillStatus) => ALL.filter(to => canChangeStatus(from, to));

describe('billStatus', () => {
  it('treats everything but draft and cancelled as issued', () => {
    expect(isIssued({ status: 'draft' })).toBe(false);
    expect(isIssued({ status: 'cancelled' })).toBe(false);
    expect(isIssued({ status: 'overdue' })).toBe(true);
  });

  it('lets a draft be sent or cancelled only', () => {
    expect(targets('draft')).toEqual(['sent', 'cancelled']);
  });

  it('moves an issued bill among issued statuses, never back to draft or cancelled', () => {
    expect(targets('sent')).toEqual(['partial', 'paid', 'overdue']);
    expect(targets('paid')).toEqual(['sent', 'partial', 'overdue']);
    expect(targets('overdue')).toEqual(['sent', 'partial', 'paid']);
  });

  it('allows nothing from a cancelled bill', () => {
    expect(targets('cancelled')).toEqual([]);
  });
});
