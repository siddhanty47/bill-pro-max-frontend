/**
 * @file RTK Query API for employee management.
 */
import { baseApi } from './baseApi';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput, PaginatedResponse } from '../types';

export const employeeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** List employees for a business (supports ?type= filter) */
    getEmployees: builder.query<
      PaginatedResponse<Employee>,
      { businessId: string; type?: string }
    >({
      query: ({ businessId, type }) => {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        params.set('pageSize', '100');
        const qs = params.toString();
        return `/businesses/${businessId}/employees${qs ? `?${qs}` : ''}`;
      },
      providesTags: (_result, _error, { businessId }) => [
        { type: 'Employee' as const, id: businessId },
      ],
    }),

    /** Create a new employee */
    createEmployee: builder.mutation<
      { success: boolean; data: Employee },
      { businessId: string; data: CreateEmployeeInput }
    >({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/employees`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Employee' as const, id: businessId },
      ],
    }),

    /** Update an employee */
    updateEmployee: builder.mutation<
      { success: boolean; data: Employee },
      { businessId: string; employeeId: string; data: UpdateEmployeeInput }
    >({
      query: ({ businessId, employeeId, data }) => ({
        url: `/businesses/${businessId}/employees/${employeeId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Employee' as const, id: businessId },
      ],
    }),

    /** Soft delete an employee */
    deleteEmployee: builder.mutation<
      { success: boolean; data: Employee },
      { businessId: string; employeeId: string }
    >({
      query: ({ businessId, employeeId }) => ({
        url: `/businesses/${businessId}/employees/${employeeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Employee' as const, id: businessId },
      ],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} = employeeApi;
