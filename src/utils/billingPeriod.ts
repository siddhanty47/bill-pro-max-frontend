/**
 * Billing period helpers shared by the bill forms. Dates are calendar days ("YYYY-MM-DD").
 */
import type { Agreement } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-06-01" -> "2026-06-30"; undefined for anything that isn't a full date. */
export function monthEndOf(day: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(day);
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
}

/**
 * What is wrong with a period, if anything: an end before the start is an error; a period that
 * runs past the end of its start month is a warning (bills are normally one month).
 */
export function periodProblem(
  start: string,
  end: string
): { level: 'error' | 'warning'; message: string } | undefined {
  if (!monthEndOf(start) || !monthEndOf(end)) return undefined;
  if (end < start) return { level: 'error', message: 'End date must be on or after the start' };
  const months =
    (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
    Number(end.slice(5, 7)) -
    Number(start.slice(5, 7)) +
    1;
  if (months <= 1) return undefined;
  const name = (day: string) => MONTHS[Number(day.slice(5, 7)) - 1];
  return {
    level: 'warning',
    message: `This period covers ${months} months (${name(start)} to ${name(end)}). Bills are usually one month.`,
  };
}

/** Agreements a bill can be made for: active ones, and one closed by a rate change. */
export function isBillableAgreement(a: Pick<Agreement, 'status' | 'nextAgreementId'>): boolean {
  return a.status === 'active' || (a.status === 'expired' && Boolean(a.nextAgreementId));
}
