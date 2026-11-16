export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const TONES: Record<string, Tone> = {
  paid: 'success',
  active: 'success',
  confirmed: 'success',
  completed: 'success',
  sent: 'info',
  delivery: 'info',
  partial: 'warning',
  pending: 'warning',
  return: 'warning',
  overdue: 'danger',
  failed: 'danger',
  cancelled: 'danger',
  terminated: 'danger',
};

export function statusTone(status: string | undefined): Tone {
  if (!status) return 'neutral';
  const key = status.toLowerCase();
  return Object.prototype.hasOwnProperty.call(TONES, key) ? TONES[key] : 'neutral';
}

export function statusLabel(status: string): string {
  const text = status.replace(/_/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
