/**
 * Indian financial year (1 Apr - 31 Mar) helpers. Mirrors backend `src/billing/yearClose.ts`:
 * calendar days are IST dates, stored as UTC midnight.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DEADLINE = '11-30';

/** Start year of a label like '2025-26'. */
const startYear = (fy: string): number => Number(fy.slice(0, 4));

/** The IST calendar day of an instant, as UTC midnight (ms). */
const istDay = (d: Date): number => Math.floor((d.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS;

/** Indian financial year label (e.g. '2025-26') of the IST day containing `day`. */
export function fyOf(day: Date): string {
  const wall = new Date(day.getTime() + IST_OFFSET_MS);
  const year = wall.getUTCFullYear();
  const start = wall.getUTCMonth() < 3 ? year - 1 : year;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** 31 March of the FY, UTC midnight. */
export const fyEnd = (fy: string): Date => new Date(Date.UTC(startYear(fy) + 1, 2, 31));

/**
 * Credit-note deadline of an FY: `MM-DD` in the year after the FY starts, UTC midnight. A setting
 * that is not a real calendar day falls back to '11-30'.
 */
export function creditNoteDeadline(fy: string, setting: string = DEFAULT_DEADLINE): Date {
  const year = startYear(fy) + 1;
  const m = /^(\d{2})-(\d{2})$/.exec(setting);
  if (m) {
    const date = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
    if (date.getUTCMonth() === Number(m[1]) - 1 && date.getUTCDate() === Number(m[2])) return date;
  }
  return new Date(Date.UTC(year, 10, 30));
}

/** True when today's IST day is after the FY's credit-note deadline day. */
export function isPastCreditDeadline(
  fy: string,
  setting: string | undefined,
  today: Date
): boolean {
  return istDay(today) > creditNoteDeadline(fy, setting).getTime();
}
