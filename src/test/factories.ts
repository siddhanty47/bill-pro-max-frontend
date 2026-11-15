/**
 * Test data factories built from src/types. Pass overrides for the fields the
 * test cares about; keep defaults minimal and valid.
 */
import type { AppNotification } from '../types';

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
