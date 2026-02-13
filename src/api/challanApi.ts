/**
 * Challan API endpoints
 */
import { baseApi } from './baseApi';
import type { Challan, CreateChallanInput, ApiResponse, PaginatedResponse } from '../types';

export const challanApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChallans: builder.query<Challan[], string>({
      query: (businessId) => `/businesses/${businessId}/challans`,
      transformResponse: (response: PaginatedResponse<Challan>) => response.data,
      providesTags: ['Challan'],
    }),

    getChallan: builder.query<Challan, { businessId: string; challanId: string }>({
      query: ({ businessId, challanId }) => `/businesses/${businessId}/challans/${challanId}`,
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      providesTags: (_result, _error, { challanId }) => [{ type: 'Challan', id: challanId }],
    }),

    createChallan: builder.mutation<Challan, { businessId: string; data: CreateChallanInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/challans`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      invalidatesTags: ['Challan', 'Inventory'],
    }),

    confirmChallan: builder.mutation<Challan, { businessId: string; challanId: string; confirmedBy: string }>({
      query: ({ businessId, challanId, confirmedBy }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/confirm`,
        method: 'POST',
        body: { confirmedBy },
      }),
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      invalidatesTags: (_result, _error, { challanId }) => [{ type: 'Challan', id: challanId }, 'Challan', 'Inventory'],
    }),
  }),
});

export const {
  useGetChallansQuery,
  useGetChallanQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
} = challanApi;
