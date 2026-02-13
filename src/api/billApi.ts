/**
 * Bill API endpoints
 */
import { baseApi } from './baseApi';
import type { Bill, GenerateBillInput, ApiResponse, PaginatedResponse } from '../types';

export const billApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBills: builder.query<Bill[], string>({
      query: (businessId) => `/businesses/${businessId}/bills`,
      transformResponse: (response: PaginatedResponse<Bill>) => response.data,
      providesTags: ['Bill'],
    }),

    getBill: builder.query<Bill, { businessId: string; billId: string }>({
      query: ({ businessId, billId }) => `/businesses/${businessId}/bills/${billId}`,
      transformResponse: (response: ApiResponse<Bill>) => response.data,
      providesTags: (_result, _error, { billId }) => [{ type: 'Bill', id: billId }],
    }),

    getOverdueBills: builder.query<Bill[], string>({
      query: (businessId) => `/businesses/${businessId}/bills/overdue`,
      transformResponse: (response: ApiResponse<Bill[]>) => response.data,
      providesTags: ['Bill'],
    }),

    getPaymentSummary: builder.query<{ totalDue: number; totalPaid: number; overdue: number }, string>({
      query: (businessId) => `/businesses/${businessId}/bills/payment-summary`,
      transformResponse: (response: ApiResponse<{ totalDue: number; totalPaid: number; overdue: number }>) => response.data,
    }),

    generateBill: builder.mutation<Bill, { businessId: string; data: GenerateBillInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/bills/generate`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Bill>) => response.data,
      invalidatesTags: ['Bill'],
    }),

    updateBillStatus: builder.mutation<Bill, { businessId: string; billId: string; status: Bill['status'] }>({
      query: ({ businessId, billId, status }) => ({
        url: `/businesses/${businessId}/bills/${billId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (response: ApiResponse<Bill>) => response.data,
      invalidatesTags: (_result, _error, { billId }) => [{ type: 'Bill', id: billId }, 'Bill'],
    }),

    /**
     * Delete a bill
     * @param force - Set to true to delete bills with any status (not just draft/cancelled)
     */
    deleteBill: builder.mutation<void, { businessId: string; billId: string; force?: boolean }>({
      query: ({ businessId, billId, force }) => ({
        url: `/businesses/${businessId}/bills/${billId}${force ? '?force=true' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Bill'],
    }),
  }),
});

export const {
  useGetBillsQuery,
  useGetBillQuery,
  useGetOverdueBillsQuery,
  useGetPaymentSummaryQuery,
  useGenerateBillMutation,
  useUpdateBillStatusMutation,
  useDeleteBillMutation,
} = billApi;
