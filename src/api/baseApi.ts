/**
 * Base API configuration with RTK Query
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../store';

/**
 * Base query with auth header injection
 */
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/**
 * Base query with re-auth on 401
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Token expired - dispatch logout
    // In a real app, you'd try to refresh the token here
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
  tagTypes: ['Business', 'Party', 'Inventory', 'Challan', 'Bill', 'Payment', 'Agreement', 'Member', 'Invitation', 'Notification', 'Employee'],
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
