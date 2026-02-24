/**
 * Payment API endpoints
 */
import { baseApi } from './baseApi';
import type { Payment, CreatePaymentInput, PaymentStats, ApiResponse, PaginatedResponse } from '../types';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayments: builder.query<Payment[], string>({
      query: (businessId) => `/businesses/${businessId}/payments?pageSize=100`,
      transformResponse: (response: PaginatedResponse<Payment>) => response.data,
      providesTags: ['Payment'],
    }),

    getPayment: builder.query<Payment, { businessId: string; paymentId: string }>({
      query: ({ businessId, paymentId }) => `/businesses/${businessId}/payments/${paymentId}`,
      transformResponse: (response: ApiResponse<Payment>) => response.data,
      providesTags: (_result, _error, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),

    getPaymentStats: builder.query<PaymentStats, string>({
      query: (businessId) => `/businesses/${businessId}/payments/stats`,
      transformResponse: (response: ApiResponse<PaymentStats>) => response.data,
    }),

    createPayment: builder.mutation<Payment, { businessId: string; data: CreatePaymentInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/payments`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Payment>) => response.data,
      invalidatesTags: ['Payment', 'Bill'],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useGetPaymentStatsQuery,
  useCreatePaymentMutation,
} = paymentApi;
