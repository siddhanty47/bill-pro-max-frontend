/**
 * @file RTK Query API for employee management.
 */
import { baseApi } from './baseApi';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput, PaginatedResponse } from '../types';

export const employeeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** List employees for a business (supports ?type=, ?search=, ?isActive= filters) */
    getEmployees: builder.query<
      PaginatedResponse<Employee>,
      { businessId: string; type?: string; search?: string; isActive?: string }
    >({
      query: ({ businessId, type, search, isActive }) => {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (search) params.set('search', search);
        if (isActive) params.set('isActive', isActive);
        params.set('pageSize', '100');
        const qs = params.toString();
        return `/businesses/${businessId}/employees${qs ? `?${qs}` : ''}`;
      },
      providesTags: (_result, _error, { businessId }) => [
        { type: 'Employee' as const, id: businessId },
      ],
    }),

    /** Get a single employee by ID */
    getEmployeeById: builder.query<
      { success: boolean; data: Employee },
      { businessId: string; employeeId: string }
    >({
      query: ({ businessId, employeeId }) =>
        `/businesses/${businessId}/employees/${employeeId}`,
      providesTags: (_result, _error, { employeeId }) => [
        { type: 'Employee' as const, id: employeeId },
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
        { type: 'AuditLog' as const },
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
      invalidatesTags: (_result, _error, { businessId, employeeId }) => [
        { type: 'Employee' as const, id: businessId },
        { type: 'Employee' as const, id: employeeId },
        { type: 'AuditLog' as const },
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
      invalidatesTags: (_result, _error, { businessId, employeeId }) => [
        { type: 'Employee' as const, id: businessId },
        { type: 'Employee' as const, id: employeeId },
        { type: 'AuditLog' as const },
      ],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetEmployeeByIdQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} = employeeApi;
