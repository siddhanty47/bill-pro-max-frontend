/**
 * Test data factories built from src/types. Pass overrides for the fields the
 * test cares about; keep defaults minimal and valid.
 */
import type { AppNotification, Bill, BillItem, BillNote } from '../types';

let seq = 0;
const next = (): number => ++seq;

export function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  const n = next();
  return {
    _id: `notif-${n}`,
    userId: 'user-1',
    type: 'info',
    title: `Notification ${n}`,
    message: `Message ${n}`,
    isRead: false,
    createdAt: new Date(2026, 0, n).toISOString(),
    ...overrides,
  };
}

/** A draft manual credit note of ₹1,180 (₹1,000 + 18% intra GST) on bill `bill-1`. */
export function makeBillNote(overrides: Partial<BillNote> = {}): BillNote {
  const n = next();
  return {
    _id: `note-${n}`,
    businessId: 'biz-1',
    partyId: 'p1',
    agreementId: 'AG-001',
    siteCode: 'S1',
    billId: 'bill-1',
    billNumber: 'INV-2026-27-0007',
    type: 'credit',
    source: 'manual',
    status: 'draft',
    reason: 'Rate agreed lower',
    lines: [{ kind: 'hire', description: 'Prop hire', amount: 1000 }],
    subtotal: 1000,
    discountAmount: 0,
    taxMode: 'intra',
    sgstRate: 9,
    cgstRate: 9,
    igstRate: 0,
    sgstAmount: 90,
    cgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    totalAmount: 1180,
    causes: [],
    createdBy: { userId: 'user-1', name: 'Asha' },
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

/** One hire line: 10 pieces for 30 days at ₹10 a day. */
export function makeBillItem(overrides: Partial<BillItem> = {}): BillItem {
  const n = next();
  return {
    itemId: `item-${n}`,
    itemName: `Item ${n}`,
    quantity: 10,
    ratePerDay: 10,
    totalDays: 30,
    amount: 3000,
    ...overrides,
  };
}

/** A sent October 2026 bill of ₹11,800 with ₹1,000 paid and one item line. */
export function makeBill(overrides: Partial<Bill> = {}): Bill {
  const n = next();
  return {
    _id: `bill-${n}`,
    businessId: 'biz-1',
    billNumber: `INV-2026-27-${String(n).padStart(4, '0')}`,
    partyId: 'p1',
    agreementId: 'AG-001',
    billingPeriod: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T00:00:00.000Z' },
    billDate: '2026-11-01T00:00:00.000Z',
    items: [makeBillItem({ itemName: 'Ladder 1.5m' })],
    subtotal: 10000,
    taxAmount: 1800,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 11800,
    currency: 'INR',
    status: 'sent',
    dueDate: '2026-11-30T00:00:00.000Z',
    amountPaid: 1000,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}
