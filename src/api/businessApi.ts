/**
 * Business API endpoints
 */
import { baseApi } from './baseApi';
import type { Business, CreateBusinessInput, ApiResponse } from '../types';

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
      invalidatesTags: ['Business'],
    }),
  }),
});

export const { useGetBusinessesQuery, useGetBusinessQuery, useCreateBusinessMutation } = businessApi;
