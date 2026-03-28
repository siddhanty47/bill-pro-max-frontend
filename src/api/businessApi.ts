/**
 * Business API endpoints
 */
import { baseApi } from './baseApi';
import type { Business, CreateBusinessInput, UpdateBusinessInput, ApiResponse } from '../types';

export const businessApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBusinesses: builder.query<Business[], void>({
      query: () => '/businesses',
      transformResponse: (response: ApiResponse<Business[]>) => response.data,
      providesTags: ['Business'],
    }),

    getBusiness: builder.query<Business, string>({
      query: (id) => `/businesses/${id}`,
      transformResponse: (response: ApiResponse<Business>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Business', id }],
    }),

    createBusiness: builder.mutation<Business, CreateBusinessInput>({
      query: (data) => ({
        url: '/businesses',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Business>) => response.data,
      invalidatesTags: ['Business', 'AuditLog'],
    }),

    updateBusiness: builder.mutation<
      Business,
      { businessId: string; data: UpdateBusinessInput }
    >({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Business>) => response.data,
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Business', id: businessId },
        'Business',
        'AuditLog',
      ],
    }),
  }),
});

export const {
  useGetBusinessesQuery,
  useGetBusinessQuery,
  useCreateBusinessMutation,
  useUpdateBusinessMutation,
} = businessApi;
