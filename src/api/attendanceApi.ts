/**
 * @file RTK Query API for employee attendance tracking.
 */
import { baseApi } from './baseApi';
import type { Attendance, MarkAttendanceInput, AttendanceSummary, SalaryBreakdown } from '../types';

export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** Get attendance records for an employee within a date range */
    getAttendance: builder.query<
      { success: boolean; data: Attendance[] },
      { businessId: string; employeeId: string; startDate: string; endDate: string }
    >({
      query: ({ businessId, employeeId, startDate, endDate }) =>
        `/businesses/${businessId}/employees/${employeeId}/attendance?startDate=${startDate}&endDate=${endDate}`,
      providesTags: (_result, _error, { employeeId }) => [
        { type: 'Attendance' as const, id: employeeId },
      ],
    }),

    /** Get month summary for an employee */
    getAttendanceSummary: builder.query<
      { success: boolean; data: AttendanceSummary },
      { businessId: string; employeeId: string; month: number; year: number }
    >({
      query: ({ businessId, employeeId, month, year }) =>
        `/businesses/${businessId}/employees/${employeeId}/attendance/summary?month=${month}&year=${year}`,
      providesTags: (_result, _error, { employeeId }) => [
        { type: 'Attendance' as const, id: employeeId },
      ],
    }),

    /** Get salary breakdown for a month */
    getSalaryBreakdown: builder.query<
      { success: boolean; data: SalaryBreakdown },
      { businessId: string; employeeId: string; month: number; year: number }
    >({
      query: ({ businessId, employeeId, month, year }) =>
        `/businesses/${businessId}/employees/${employeeId}/attendance/salary-breakdown?month=${month}&year=${year}`,
      providesTags: (_result, _error, { employeeId }) => [
        { type: 'Attendance' as const, id: employeeId },
      ],
    }),

    /** Mark attendance for a date (upsert) */
    markAttendance: builder.mutation<
      { success: boolean; data: Attendance },
      { businessId: string; employeeId: string; data: MarkAttendanceInput }
    >({
      query: ({ businessId, employeeId, data }) => ({
        url: `/businesses/${businessId}/employees/${employeeId}/attendance`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { employeeId }) => [
        { type: 'Attendance' as const, id: employeeId },
        { type: 'AuditLog' as const },
      ],
    }),

    /** Delete attendance record for a date */
    deleteAttendance: builder.mutation<
      { success: boolean; data: Attendance },
      { businessId: string; employeeId: string; date: string }
    >({
      query: ({ businessId, employeeId, date }) => ({
        url: `/businesses/${businessId}/employees/${employeeId}/attendance/${date}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { employeeId }) => [
        { type: 'Attendance' as const, id: employeeId },
        { type: 'AuditLog' as const },
      ],
    }),
  }),
});

export const {
  useGetAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useGetSalaryBreakdownQuery,
  useMarkAttendanceMutation,
  useDeleteAttendanceMutation,
} = attendanceApi;
