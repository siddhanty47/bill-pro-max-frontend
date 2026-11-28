/**
 * @file The signed-in user's preferences (backend `routes/v1/auth.ts` PATCH /auth/preferences)
 */
import { baseApi } from './baseApi';
import type { ThemePreference } from '../theme/theme';

export const preferencesApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    updatePreferences: builder.mutation<{ theme: ThemePreference }, { theme: ThemePreference }>({
      query: body => ({ url: '/auth/preferences', method: 'PATCH', body }),
      transformResponse: (response: { data: { theme: ThemePreference } }) => response.data,
    }),
  }),
});

export const { useUpdatePreferencesMutation } = preferencesApi;
