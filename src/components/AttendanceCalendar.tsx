/**
 * @file AttendanceCalendar
 * @description Month-view calendar for marking/viewing employee attendance.
 * Non-marked weekdays (Mon-Sat) show as implicit present.
 * Sundays show as implicit leave unless explicitly marked.
 */
import { useState, useMemo, useCallback } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useMarkAttendanceMutation,
  useDeleteAttendanceMutation,
} from '../api/attendanceApi';
import { getErrorMessage } from '../api/baseApi';
import type { AttendanceStatus } from '../types';
import styles from './AttendanceCalendar.module.css';

interface AttendanceCalendarProps {
  employeeId: string;
}

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'half-day', 'leave'];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  'half-day': 'H',
  leave: 'L',
};

const STATUS_FULL_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  'half-day': 'Half Day',
  leave: 'Leave',
};

const DOT_CLASS: Record<AttendanceStatus, string> = {
  present: 'dotPresent',
  absent: 'dotAbsent',
  'half-day': 'dotHalfDay',
  leave: 'dotLeave',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - lastDay.getDate() - startDow + 1);
    days.push({ date: d, inMonth: false });
  }

  return days;
}

export function AttendanceCalendar({ employeeId }: AttendanceCalendarProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [otHoursInput, setOtHoursInput] = useState('');

  const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: attendanceResponse, isLoading } = useGetAttendanceQuery(
    {
      businessId: currentBusinessId!,
      employeeId,
      startDate,
      endDate,
    },
    { skip: !currentBusinessId }
  );

  const { data: summaryResponse } = useGetAttendanceSummaryQuery(
    {
      businessId: currentBusinessId!,
      employeeId,
      month: viewMonth + 1,
      year: viewYear,
    },
    { skip: !currentBusinessId }
  );

  const [markAttendance] = useMarkAttendanceMutation();
  const [deleteAttendance] = useDeleteAttendanceMutation();

  const attendanceMap = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; overtimeHours?: number; notes?: string }>();
    if (attendanceResponse?.data) {
      for (const record of attendanceResponse.data) {
        const key = toDateKey(new Date(record.date));
        map.set(key, { status: record.status, overtimeHours: record.overtimeHours, notes: record.notes });
      }
    }
    return map;
  }, [attendanceResponse]);

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const summary = summaryResponse?.data;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setActiveDropdown(null);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setActiveDropdown(null);
  };

  const handleMarkStatus = useCallback(
    async (dateKey: string, status: AttendanceStatus, overtimeHours?: number) => {
      if (!currentBusinessId) return;
      try {
        await markAttendance({
          businessId: currentBusinessId,
          employeeId,
          data: { date: dateKey, status, overtimeHours },
        }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
      setActiveDropdown(null);
      setOtHoursInput('');
    },
    [currentBusinessId, employeeId, markAttendance]
  );

  const handleSaveOvertime = useCallback(
    async (dateKey: string) => {
      if (!currentBusinessId) return;
      const hours = parseFloat(otHoursInput);
      if (isNaN(hours) || hours < 0) return;
      const record = attendanceMap.get(dateKey);
      const status = record?.status ?? 'present';
      try {
        await markAttendance({
          businessId: currentBusinessId,
          employeeId,
          data: { date: dateKey, status, overtimeHours: hours },
        }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
      setActiveDropdown(null);
      setOtHoursInput('');
    },
    [currentBusinessId, employeeId, markAttendance, attendanceMap, otHoursInput]
  );

  const handleClear = useCallback(
    async (dateKey: string) => {
      if (!currentBusinessId) return;
      try {
        await deleteAttendance({
          businessId: currentBusinessId,
          employeeId,
          date: dateKey,
        }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
      setActiveDropdown(null);
      setOtHoursInput('');
    },
    [currentBusinessId, employeeId, deleteAttendance]
  );

  const handleDayClick = (dateKey: string, inMonth: boolean) => {
    if (!inMonth) return;
    const d = new Date(dateKey + 'T00:00:00');
    if (d > today) return;
    if (activeDropdown === dateKey) {
      setActiveDropdown(null);
      setOtHoursInput('');
    } else {
      setActiveDropdown(dateKey);
      const record = attendanceMap.get(dateKey);
      setOtHoursInput(record?.overtimeHours ? String(record.overtimeHours) : '');
    }
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const isFutureMonth = viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <div className={styles.container}>
      {/* Summary bar */}
      {summary && (
        <div className={styles.summary}>
          <span className={styles.summaryItem}>
            <span className={`${styles.dot} ${styles.dotPresent}`} />
            P: {summary.present}
          </span>
          <span className={styles.summaryItem}>
            <span className={`${styles.dot} ${styles.dotAbsent}`} />
            A: {summary.absent}
          </span>
          <span className={styles.summaryItem}>
            <span className={`${styles.dot} ${styles.dotHalfDay}`} />
            H: {summary.halfDay}
          </span>
          <span className={styles.summaryItem}>
            <span className={`${styles.dot} ${styles.dotLeave}`} />
            L: {summary.leave}
          </span>
          <span className={styles.summaryDivider} />
          <span className={styles.summaryItem}>
            OT: {summary.overtimeHours}h
          </span>
          <span className={styles.summaryItem}>
            Sun: {summary.sundaysWorked}
          </span>
          <span className={styles.summaryDivider} />
          <span className={styles.summaryEffective}>
            Effective: {summary.effectiveDays} days
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div className={styles.nav}>
        <button className={styles.navBtn} onClick={handlePrevMonth} type="button">
          &larr;
        </button>
        <span className={styles.navLabel}>{monthLabel}</span>
        <button
          className={styles.navBtn}
          onClick={handleNextMonth}
          disabled={isFutureMonth}
          type="button"
        >
          &rarr;
        </button>
      </div>

      {/* Calendar grid */}
      <div className={styles.grid}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} className={`${styles.weekdayHeader} ${wd === 'Sun' ? styles.weekdaySunday : ''}`}>
            {wd}
          </div>
        ))}
        {days.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const record = attendanceMap.get(key);
          const isFuture = date > today;
          const isToday = toDateKey(date) === toDateKey(today);
          const isClickable = inMonth && !isFuture;
          const isSunday = date.getDay() === 0;
          const isPastOrToday = inMonth && !isFuture;

          // Determine display status
          let displayStatus: AttendanceStatus | null = null;
          let isImplicit = false;

          if (record && inMonth) {
            displayStatus = record.status;
          } else if (isPastOrToday && inMonth) {
            // Implicit status for days without explicit records
            if (isSunday) {
              displayStatus = 'leave';
              isImplicit = true;
            } else {
              displayStatus = 'present';
              isImplicit = true;
            }
          }

          const isSundayWorked = isSunday && record?.status === 'present';
          const otHours = record?.overtimeHours;

          return (
            <div
              key={key}
              className={`${styles.dayCell} ${!inMonth ? styles.dayCellOutside : ''} ${isToday ? styles.dayCellToday : ''} ${isClickable ? styles.dayCellClickable : ''} ${isSunday && inMonth ? styles.dayCellSunday : ''}`}
              onClick={() => isClickable && handleDayClick(key, inMonth)}
            >
              <span className={styles.dayNumber}>{date.getDate()}</span>
              {displayStatus && (
                <span
                  className={`${styles.statusBadge} ${styles[`status-${displayStatus}`]} ${isImplicit ? styles.statusImplicit : ''} ${isSundayWorked ? styles.sundayWorked : ''}`}
                  title={isImplicit ? `Implicit ${STATUS_FULL_LABELS[displayStatus]}` : STATUS_FULL_LABELS[displayStatus]}
                >
                  {STATUS_LABELS[displayStatus]}
                </span>
              )}
              {otHours != null && otHours > 0 && inMonth && (
                <span className={styles.overtimeIndicator}>+{otHours}h</span>
              )}
              {activeDropdown === key && (
                <div className={styles.dropdown} onClick={(e) => e.stopPropagation()}>
                  {STATUS_CYCLE.map((s) => (
                    <button
                      key={s}
                      className={`${styles.dropdownItem} ${record?.status === s ? styles.dropdownItemActive : ''}`}
                      onClick={() => handleMarkStatus(key, s, record?.overtimeHours)}
                      type="button"
                    >
                      <span className={`${styles.dot} ${styles[DOT_CLASS[s]]}`} />
                      {STATUS_FULL_LABELS[s]}
                    </button>
                  ))}
                  <div className={styles.dropdownDivider} />
                  <div className={styles.dropdownOvertimeRow}>
                    <label className={styles.overtimeLabel}>OT Hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={otHoursInput}
                      onChange={(e) => setOtHoursInput(e.target.value)}
                      className={styles.overtimeInput}
                      placeholder="0"
                    />
                    <button
                      className={styles.overtimeSaveBtn}
                      onClick={() => handleSaveOvertime(key)}
                      type="button"
                    >
                      Save
                    </button>
                  </div>
                  {record && (
                    <>
                      <div className={styles.dropdownDivider} />
                      <button
                        className={`${styles.dropdownItem} ${styles.dropdownItemClear}`}
                        onClick={() => handleClear(key)}
                        type="button"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && <div className={styles.loading}>Loading attendance...</div>}
    </div>
  );
}
