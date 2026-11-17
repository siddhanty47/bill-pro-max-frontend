import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { AttendanceCalendar } from './AttendanceCalendar';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';

const ATT = '/businesses/biz-1/employees/e1/attendance';

const records = [
  { _id: 'a1', date: '2026-11-03T00:00:00.000Z', status: 'absent', overtimeHours: 2 },
  { _id: 'a2', date: '2026-11-08T00:00:00.000Z', status: 'present' },
];

const summary = {
  present: 12,
  absent: 1,
  halfDay: 2,
  leave: 3,
  totalDays: 17,
  workingDays: 26,
  effectiveDays: 14.5,
  overtimeHours: 2,
  sundaysWorked: 1,
};

function useApi() {
  const ranges: string[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(ATT), ({ request }) => {
      ranges.push(new URL(request.url).searchParams.get('startDate') ?? '');
      return ok(records);
    }),
    http.get(apiUrl(`${ATT}/summary`), () => ok(summary))
  );
  return ranges;
}

function capturePost() {
  const bodies: unknown[] = [];
  server.use(
    http.post(apiUrl(ATT), async ({ request }) => {
      bodies.push(await request.json());
      return ok({});
    })
  );
  return bodies;
}

function renderCalendar() {
  return renderWithProviders(<AttendanceCalendar employeeId="e1" />, {
    preloadedState: signedIn(),
  });
}

/** Day button by its day-of-month in November 2026. */
const day = (n: number) =>
  screen.getByRole('button', { name: new RegExp(`^\\w+, ${n} November 2026`) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T10:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AttendanceCalendar', () => {
  it('shows the legend with month counts and totals', async () => {
    useApi();
    renderCalendar();
    expect(await screen.findByText('Sundays worked')).toBeVisible();
    expect(screen.getByText('Half day')).toBeVisible();
    expect(within(screen.getByText('Present').parentElement!).getByText('12')).toHaveClass('mono');
    expect(screen.getByText('14.5')).toHaveClass('mono');
    expect(screen.getByText('November 2026')).toBeVisible();
  });

  it('labels each day with its date and status', async () => {
    useApi();
    renderCalendar();
    await waitFor(() =>
      expect(day(3)).toHaveAccessibleName('Tuesday, 3 November 2026, Absent, 2 hours overtime')
    );
    expect(day(8)).toHaveAccessibleName('Sunday, 8 November 2026, Present');
    expect(day(1)).toHaveAccessibleName('Sunday, 1 November 2026, Leave (not marked)');
    expect(day(2)).toHaveAccessibleName('Monday, 2 November 2026, Present (not marked)');
    expect(day(18)).toHaveAccessibleName('Wednesday, 18 November 2026, Upcoming');
    expect(day(18)).toBeDisabled();
    expect(day(17)).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks a status and keeps the existing overtime', async () => {
    useApi();
    const bodies = capturePost();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(3)).toHaveAccessibleName(/Absent/));
    await user.click(day(3));
    expect(day(3)).toHaveAttribute('aria-pressed', 'true');
    const editor = screen.getByRole('group', { name: /Mark Tuesday, 3 November 2026/ });
    expect(within(editor).getByRole('button', { name: 'Absent' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await user.click(within(editor).getByRole('button', { name: 'Half day' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ date: '2026-11-03', status: 'half-day', overtimeHours: 2 }])
    );
    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
  });

  it('marks an unmarked day without overtime', async () => {
    useApi();
    const bodies = capturePost();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(bodies).toEqual([{ date: '2026-11-10', status: 'leave' }]));
  });

  it('saves overtime hours with the current or default status', async () => {
    useApi();
    const bodies = capturePost();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    await user.type(screen.getByRole('spinbutton', { name: 'Overtime hours' }), '3.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ date: '2026-11-10', status: 'present', overtimeHours: 3.5 }])
    );
  });

  it('ignores an empty overtime value', async () => {
    useApi();
    const bodies = capturePost();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(bodies).toEqual([]);
  });

  it('clears a marked day', async () => {
    useApi();
    const deleted: string[] = [];
    server.use(
      http.delete(apiUrl(`${ATT}/2026-11-08`), ({ request }) => {
        deleted.push(new URL(request.url).pathname);
        return ok({});
      })
    );
    const { user } = renderCalendar();
    await waitFor(() => expect(day(8)).toHaveAccessibleName(/Present$/));
    await user.click(day(8));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(deleted).toHaveLength(1));
  });

  it('offers no Clear for an unmarked day', async () => {
    useApi();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('alerts when marking fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl(ATT), () =>
        HttpResponse.json({ success: false, error: { message: 'Locked' } }, { status: 400 })
      )
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    await user.click(screen.getByRole('button', { name: 'Absent' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Locked')));
  });

  it('toggles the editor closed on a second click and with Escape', async () => {
    useApi();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(10)).toBeEnabled());
    await user.click(day(10));
    await user.click(day(10));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    await user.click(day(10));
    expect(screen.getByRole('group')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('moves between days with the arrow keys, Home and End', async () => {
    useApi();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(17)).toBeEnabled());
    expect(day(17)).toHaveAttribute('tabindex', '0');
    expect(day(16)).toHaveAttribute('tabindex', '-1');

    day(17).focus();
    await user.keyboard('{ArrowLeft}');
    expect(day(16)).toHaveFocus();
    expect(day(16)).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowUp}');
    expect(day(9)).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(day(17)).toHaveFocus();
    // Upcoming days and the next row are not reachable
    await user.keyboard('{ArrowRight}');
    expect(day(17)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(day(17)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(day(1)).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(day(1)).toHaveFocus();
    await user.keyboard('{End}');
    expect(day(17)).toHaveFocus();
    await user.keyboard('{a}');
    expect(day(17)).toHaveFocus();
  });

  it('opens the focused day with Enter', async () => {
    useApi();
    const { user } = renderCalendar();
    await waitFor(() => expect(day(17)).toBeEnabled());
    day(17).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: /Mark Tuesday, 17 November 2026/ })).toBeVisible();
  });

  it('navigates months and disables Next on a future month', async () => {
    const ranges = useApi();
    const { user } = renderCalendar();
    expect(await screen.findByText('November 2026')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('October 2026')).toBeVisible();
    await waitFor(() => expect(ranges).toContain('2026-10-01'));
    // Every October day is in the past, so all are markable
    expect(screen.getByRole('button', { name: /31 October 2026/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('December 2026')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /, 1 December 2026/ })).toBeDisabled();
  });

  it('wraps across the year boundary', async () => {
    vi.setSystemTime(new Date('2026-01-10T10:00:00'));
    const ranges = useApi();
    const { user } = renderCalendar();
    await user.click(await screen.findByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('December 2025')).toBeVisible();
    await waitFor(() => expect(ranges).toContain('2025-12-01'));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('January 2026')).toBeVisible();
  });
});
