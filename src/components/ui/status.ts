export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/**
 * Colour for a number (StatCard value, Td): `positive` money in / settled (success
 * text), `negative` money out / owed (danger text), `warning` needs attention.
 */
export type ValueTone = 'positive' | 'negative' | 'warning';

/** `positive` above zero, `negative` below, none at zero (rounded to paise, like `formatMoney`). */
export function signTone(n: number): ValueTone | undefined {
  const paise = Math.round(n * 100);
  return paise > 0 ? 'positive' : paise < 0 ? 'negative' : undefined;
}

/** Unlisted statuses (draft, expired, inactive, …) are neutral. */
const TONES: Record<string, Tone> = {
  paid: 'success',
  active: 'success',
  confirmed: 'success',
  completed: 'success',
  accepted: 'success',
  created: 'success',
  updated: 'warning',
  deleted: 'danger',
  present: 'success',
  sent: 'info',
  issued: 'info',
  delivery: 'info',
  partial: 'warning',
  pending: 'warning',
  return: 'warning',
  'half-day': 'warning',
  leave: 'info',
  overdue: 'danger',
  failed: 'danger',
  cancelled: 'danger',
  terminated: 'danger',
  declined: 'danger',
  absent: 'danger',
  revoked: 'danger',
  suspended: 'danger',
};

export function statusTone(status: string | undefined): Tone {
  if (!status) return 'neutral';
  const key = status.toLowerCase();
  return Object.prototype.hasOwnProperty.call(TONES, key) ? TONES[key] : 'neutral';
}

/** Team role chips (not a lifecycle status): `<StatusChip status={role} tone={roleTone(role)} />`. */
const ROLE_TONES: Record<string, Tone> = {
  owner: 'success',
  manager: 'info',
  accountant: 'warning',
};

/** owner → success, manager → info, accountant → warning, staff/viewer/other → neutral. */
export function roleTone(role: string | undefined): Tone {
  const key = (role ?? '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_TONES, key) ? ROLE_TONES[key] : 'neutral';
}

export function statusLabel(status: string): string {
  const text = status.replace(/_/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
