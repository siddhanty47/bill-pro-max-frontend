/**
 * Payment API endpoints
 */
import { baseApi } from './baseApi';
import { fetchAllPages } from './fetchAllPages';
import type { Payment, CreatePaymentInput, PaymentStats, ApiResponse } from '../types';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getPayments: builder.query<Payment[], string>({
      queryFn: (businessId, _api, _extra, baseQuery) =>
        fetchAllPages<Payment>(`/businesses/${businessId}/payments`, baseQuery),
      providesTags: ['Payment'],
    }),

    getPaymentsByParty: builder.query<Payment[], { businessId: string; partyId: string }>({
      queryFn: ({ businessId, partyId }, _api, _extra, baseQuery) =>
        fetchAllPages<Payment>(
          `/businesses/${businessId}/payments?partyId=${encodeURIComponent(partyId)}`,
          baseQuery
        ),
      providesTags: ['Payment'],
    }),

    getPaymentsByBill: builder.query<Payment[], { businessId: string; billId: string }>({
      queryFn: ({ businessId, billId }, _api, _extra, baseQuery) =>
        fetchAllPages<Payment>(
          `/businesses/${businessId}/payments?billId=${encodeURIComponent(billId)}`,
          baseQuery
        ),
      providesTags: (_result, _error, { billId }) => ['Payment', { type: 'Bill', id: billId }],
    }),

    getPayment: builder.query<Payment, { businessId: string; paymentId: string }>({
      query: ({ businessId, paymentId }) => `/businesses/${businessId}/payments/${paymentId}`,
      transformResponse: (response: ApiResponse<Payment>) => response.data,
      providesTags: (_result, _error, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),

    getPaymentStats: builder.query<PaymentStats, string>({
      query: businessId => `/businesses/${businessId}/payments/stats`,
      transformResponse: (response: ApiResponse<PaymentStats>) => response.data,
    }),

    createPayment: builder.mutation<Payment, { businessId: string; data: CreatePaymentInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/payments`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Payment>) => response.data,
      invalidatesTags: ['Payment', 'Bill', 'AuditLog'],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useGetPaymentsByPartyQuery,
  useGetPaymentsByBillQuery,
  useGetPaymentQuery,
  useGetPaymentStatsQuery,
  useCreatePaymentMutation,
} = paymentApi;
