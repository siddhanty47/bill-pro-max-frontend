/**
 * Challan API endpoints
 */
import { baseApi } from './baseApi';
import type { Challan, CreateChallanInput, ItemWithParty, ApiResponse, PaginatedResponse } from '../types';

export const challanApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChallans: builder.query<Challan[], string>({
      query: (businessId) => `/businesses/${businessId}/challans?pageSize=100`,
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

    updateChallanItem: builder.mutation<
      Challan,
      { businessId: string; challanId: string; itemId: string; quantity: number }
    >({
      query: ({ businessId, challanId, itemId, quantity }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/items/${itemId}`,
        method: 'PATCH',
        body: { quantity },
      }),
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      invalidatesTags: (_result, _error, { challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
      ],
    }),

    updateChallanTransportation: builder.mutation<
      Challan,
      {
        businessId: string;
        challanId: string;
        data: {
          transporterName?: string;
          vehicleNumber?: string;
          cartageCharge?: number;
          loadingCharge?: number;
          unloadingCharge?: number;
        };
      }
    >({
      query: ({ businessId, challanId, data }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/transportation`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      invalidatesTags: (_result, _error, { challanId }) => [{ type: 'Challan', id: challanId }, 'Challan', 'Bill'],
    }),

    getNextChallanNumber: builder.query<string, { businessId: string; type: 'delivery' | 'return'; date: string }>({
      query: ({ businessId, type, date }) =>
        `/businesses/${businessId}/challans/next-number?type=${type}&date=${date}`,
      transformResponse: (response: ApiResponse<string>) => response.data,
      providesTags: ['Challan'],
    }),

    getItemsWithParty: builder.query<ItemWithParty[], { businessId: string; partyId: string; agreementId?: string }>({
      query: ({ businessId, partyId, agreementId }) => {
        const base = `/businesses/${businessId}/challans/items-with-party/${partyId}`;
        return agreementId ? `${base}?agreementId=${agreementId}` : base;
      },
      transformResponse: (response: ApiResponse<ItemWithParty[]>) => response.data,
      providesTags: ['Challan'],
    }),

    getChallansByAgreement: builder.query<Challan[], { businessId: string; agreementId: string }>({
      query: ({ businessId, agreementId }) =>
        `/businesses/${businessId}/challans?agreementId=${encodeURIComponent(agreementId)}&pageSize=100`,
      transformResponse: (response: PaginatedResponse<Challan>) => response.data,
      providesTags: ['Challan'],
    }),
  }),
});

export const {
  useGetChallansQuery,
  useGetChallanQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
  useUpdateChallanItemMutation,
  useUpdateChallanTransportationMutation,
  useGetNextChallanNumberQuery,
  useGetItemsWithPartyQuery,
  useGetChallansByAgreementQuery,
} = challanApi;
