/**
 * @file AttendanceCalendar
 * @description Month-view calendar for marking/viewing employee attendance.
 * Non-marked weekdays (Mon-Sat) show as implicit present.
 * Sundays show as implicit leave unless explicitly marked.
 * Days are buttons (aria-pressed while their editor is open); arrow keys move
 * between days, Home/End jump to the first/last markable day.
 */
import { useState, useMemo, useCallback, useRef, type KeyboardEvent } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useMarkAttendanceMutation,
  useDeleteAttendanceMutation,
} from '../api/attendanceApi';
import { getErrorMessage } from '../api/baseApi';
import { MonthNav } from './MonthNav';
import { Button, Input, Spinner, StatusChip } from './ui';
import { statusTone, type Tone } from './ui/status';
import type { AttendanceStatus } from '../types';
import { formatMonth } from '../utils/format';
import styles from './AttendanceCalendar.module.css';

interface AttendanceCalendarProps {
  employeeId: string;
}

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'half-day', 'leave'];

const STATUS_LETTERS: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  'half-day': 'H',
  leave: 'L',
};

const STATUS_FULL_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  'half-day': 'Half day',
  leave: 'Leave',
};

/** Tone per status (from the shared map); used by the legend, badges and editor dots. */
const STATUS_TONE = Object.fromEntries(
  (['present', 'absent', 'half-day', 'leave'] as AttendanceStatus[]).map(s => [s, statusTone(s)])
) as Record<AttendanceStatus, Exclude<Tone, 'neutral'>>;

const BADGE_CLASS: Record<AttendanceStatus, string> = {
  present: styles.badgePresent,
  absent: styles.badgeAbsent,
  'half-day': styles.badgeHalfDay,
  leave: styles.badgeLeave,
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
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());

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
    const map = new Map<
      string,
      { status: AttendanceStatus; overtimeHours?: number; notes?: string }
    >();
    if (attendanceResponse?.data) {
      for (const record of attendanceResponse.data) {
        const key = toDateKey(new Date(record.date));
        map.set(key, {
          status: record.status,
          overtimeHours: record.overtimeHours,
          notes: record.notes,
        });
      }
    }
    return map;
  }, [attendanceResponse]);

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const summary = summaryResponse?.data;
  const todayKey = toDateKey(today);

  /** Days that can be marked: in this month and not in the future, in date order. */
  const markableKeys = days.filter(d => d.inMonth && d.date <= today).map(d => toDateKey(d.date));
  const tabStopKey =
    focusKey && markableKeys.includes(focusKey)
      ? focusKey
      : markableKeys.includes(todayKey)
        ? todayKey
        : markableKeys[0];

  const resetEditor = (focusDay?: string) => {
    setActiveDropdown(null);
    setOtHoursInput('');
    if (focusDay) dayRefs.current.get(focusDay)?.focus();
  };

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
      resetEditor(dateKey);
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
      resetEditor(dateKey);
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
      resetEditor(dateKey);
    },
    [currentBusinessId, employeeId, deleteAttendance]
  );

  const handleDayClick = (dateKey: string) => {
    setFocusKey(dateKey);
    if (activeDropdown === dateKey) {
      resetEditor();
    } else {
      setActiveDropdown(dateKey);
      const record = attendanceMap.get(dateKey);
      setOtHoursInput(record?.overtimeHours ? String(record.overtimeHours) : '');
    }
  };

  const moveFocus = (key: string) => {
    setFocusKey(key);
    dayRefs.current.get(key)?.focus();
  };

  const handleDayKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: Date, key: string) => {
    if (e.key === 'Escape' && activeDropdown === key) {
      e.preventDefault();
      resetEditor(key);
      return;
    }
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let target: string | undefined;
    if (e.key in step) {
      const next = new Date(date);
      next.setDate(next.getDate() + step[e.key]);
      const nextKey = toDateKey(next);
      target = markableKeys.includes(nextKey) ? nextKey : undefined;
    } else if (e.key === 'Home') {
      target = markableKeys[0];
    } else if (e.key === 'End') {
      target = markableKeys[markableKeys.length - 1];
    } else {
      return;
    }
    e.preventDefault();
    if (target && target !== key) moveFocus(target);
  };

  const monthLabel = formatMonth(viewYear, viewMonth + 1);

  const isFutureMonth =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const summaryCount: Record<AttendanceStatus, number | undefined> = {
    present: summary?.present,
    absent: summary?.absent,
    'half-day': summary?.halfDay,
    leave: summary?.leave,
  };

  return (
    <div className={styles.container}>
      {/* Legend with the month's counts once the summary is loaded */}
      <div className={styles.summary}>
        {STATUS_CYCLE.map(s => (
          <span key={s} className={styles.summaryItem}>
            <StatusChip status={s}>{STATUS_FULL_LABELS[s]}</StatusChip>
            {summaryCount[s] !== undefined && <span className="mono">{summaryCount[s]}</span>}
          </span>
        ))}
        {summary && (
          <>
            <span className={styles.summaryItem}>
              Overtime <span className="mono">{summary.overtimeHours}</span> h
            </span>
            <span className={styles.summaryItem}>
              Sundays worked <span className="mono">{summary.sundaysWorked}</span>
            </span>
            <span className={`${styles.summaryItem} ${styles.summaryEffective}`}>
              Effective days <span className="mono">{summary.effectiveDays}</span>
            </span>
          </>
        )}
      </div>

      <MonthNav
        label={monthLabel}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        nextDisabled={isFutureMonth}
      />

      {/* Calendar grid */}
      <div className={styles.grid}>
        {WEEKDAYS.map(wd => (
          <div
            key={wd}
            className={`${styles.weekdayHeader} ${wd === 'Sun' ? styles.weekdaySunday : ''}`}
          >
            {wd}
          </div>
        ))}
        {days.map(({ date, inMonth }, index) => {
          const key = toDateKey(date);
          if (!inMonth) {
            return (
              <div key={key} className={`${styles.dayCell} ${styles.dayCellOutside}`}>
                <span className={styles.dayNumber} aria-hidden="true">
                  {date.getDate()}
                </span>
              </div>
            );
          }

          const record = attendanceMap.get(key);
          const isFuture = date > today;
          const isToday = key === todayKey;
          const isSunday = date.getDay() === 0;

          // Determine display status (implicit for unmarked days up to today)
          let displayStatus: AttendanceStatus | null = null;
          let isImplicit = false;
          if (record) {
            displayStatus = record.status;
          } else if (!isFuture) {
            displayStatus = isSunday ? 'leave' : 'present';
            isImplicit = true;
          }

          const isSundayWorked = isSunday && record?.status === 'present';
          const otHours = record?.overtimeHours;
          const dateLabel = date.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          const statusText = displayStatus
            ? `${STATUS_FULL_LABELS[displayStatus]}${isImplicit ? ' (not marked)' : ''}`
            : 'Upcoming';
          const column = index % 7;
          const placement =
            column <= 2
              ? styles.dropdownStart
              : column >= 4
                ? styles.dropdownEnd
                : styles.dropdownMid;
          const otText = otHours != null && otHours > 0 ? `, ${otHours} hours overtime` : '';

          return (
            <div
              key={key}
              className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${isSunday ? styles.dayCellSunday : ''}`}
            >
              <button
                type="button"
                ref={el => {
                  if (el) dayRefs.current.set(key, el);
                  else dayRefs.current.delete(key);
                }}
                className={styles.dayButton}
                disabled={isFuture}
                tabIndex={key === tabStopKey ? 0 : -1}
                aria-pressed={activeDropdown === key}
                aria-label={`${dateLabel}, ${statusText}${otText}`}
                onClick={() => handleDayClick(key)}
                onKeyDown={e => handleDayKeyDown(e, date, key)}
              >
                <span className={styles.dayNumber}>{date.getDate()}</span>
                {displayStatus && (
                  <span
                    className={`${styles.statusBadge} ${BADGE_CLASS[displayStatus]} ${isImplicit ? styles.statusImplicit : ''} ${isSundayWorked ? styles.sundayWorked : ''}`}
                    aria-hidden="true"
                  >
                    {STATUS_LETTERS[displayStatus]}
                  </span>
                )}
                {otHours != null && otHours > 0 && (
                  <span className={styles.overtimeIndicator} aria-hidden="true">
                    +{otHours}h
                  </span>
                )}
              </button>
              {activeDropdown === key && (
                <div
                  className={`${styles.dropdown} ${placement}`}
                  role="group"
                  aria-label={`Mark ${dateLabel}`}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      resetEditor(key);
                    }
                  }}
                >
                  {STATUS_CYCLE.map(s => (
                    <Button
                      key={s}
                      variant="ghost"
                      size="sm"
                      dot={STATUS_TONE[s]}
                      aria-pressed={record?.status === s}
                      onClick={() => handleMarkStatus(key, s, record?.overtimeHours)}
                    >
                      {STATUS_FULL_LABELS[s]}
                    </Button>
                  ))}
                  <div className={styles.overtimeRow}>
                    <Input
                      type="number"
                      mono
                      min="0"
                      step="0.5"
                      value={otHoursInput}
                      onChange={e => setOtHoursInput(e.target.value)}
                      aria-label="Overtime hours"
                      placeholder="0"
                    />
                    <Button size="sm" onClick={() => handleSaveOvertime(key)}>
                      Save
                    </Button>
                  </div>
                  {record && (
                    <Button variant="danger" size="sm" onClick={() => handleClear(key)}>
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && <Spinner message="Loading attendance…" />}
    </div>
  );
}
