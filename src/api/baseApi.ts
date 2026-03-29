/**
 * Base API configuration with RTK Query
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../store';
import { supabase } from '../lib/supabase';

/**
 * Base query with auth header injection.
 * Checks Supabase for a fresh token before each request.
 */
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  prepareHeaders: async (headers, { getState }) => {
    // Try to get fresh token from Supabase (handles auto-refresh)
    let token = (getState() as RootState).auth.token;

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        token = data.session.access_token;
      }
    } catch {
      // Fall back to Redux token
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/**
 * Base query with logout on 401
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    api.dispatch({ type: 'auth/logout' });
  }

  return result;
};

/**
 * Base API - all other APIs will inject endpoints into this
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Business', 'Party', 'Inventory', 'Challan', 'Bill', 'Payment', 'Agreement', 'Member', 'Invitation', 'Notification', 'Employee', 'Attendance', 'ShareLink', 'Preset', 'AuditLog'],
  endpoints: () => ({}),
});

/**
 * Extract error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('data' in error) {
      const data = error.data as { error?: { message?: string }; message?: string };
      return data?.error?.message || data?.message || 'An error occurred';
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return 'An unexpected error occurred';
}
