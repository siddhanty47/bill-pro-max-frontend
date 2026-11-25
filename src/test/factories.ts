/**
 * Test data factories built from src/types. Pass overrides for the fields the
 * test cares about; keep defaults minimal and valid.
 */
import type { AppNotification, BillNote } from '../types';

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
