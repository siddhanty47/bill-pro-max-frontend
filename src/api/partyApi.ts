/**
 * Party API endpoints
 */
import { baseApi } from './baseApi';
import type { Party, CreatePartyInput, CreateAgreementInput, AddSiteInput, ApiResponse, PaginatedResponse } from '../types';

export const partyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getParties: builder.query<Party[], string>({
      query: (businessId) => `/businesses/${businessId}/parties`,
      transformResponse: (response: PaginatedResponse<Party>) => response.data,
      providesTags: ['Party'],
    }),

    getParty: builder.query<Party, { businessId: string; partyId: string }>({
      query: ({ businessId, partyId }) => `/businesses/${businessId}/parties/${partyId}`,
      transformResponse: (response: ApiResponse<Party>) => response.data,
      providesTags: (_result, _error, { partyId }) => [{ type: 'Party', id: partyId }],
    }),

    createParty: builder.mutation<Party, { businessId: string; data: CreatePartyInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/parties`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: ['Party'],
    }),

    updateParty: builder.mutation<Party, { businessId: string; partyId: string; data: Partial<CreatePartyInput> }>({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [{ type: 'Party', id: partyId }, 'Party'],
    }),

    deleteParty: builder.mutation<void, { businessId: string; partyId: string }>({
      query: ({ businessId, partyId }) => ({
        url: `/businesses/${businessId}/parties/${partyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Party'],
    }),

    createAgreement: builder.mutation<Party, { businessId: string; partyId: string; data: CreateAgreementInput }>({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/agreements`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [{ type: 'Party', id: partyId }, 'Party'],
    }),

    generatePartyCode: builder.query<string, { businessId: string; name: string }>({
      query: ({ businessId, name }) => `/businesses/${businessId}/parties/generate-code?name=${encodeURIComponent(name)}`,
      transformResponse: (response: ApiResponse<{ code: string }>) => response.data.code,
    }),

    checkPartyCodeExists: builder.query<boolean, { businessId: string; code: string }>({
      query: ({ businessId, code }) => `/businesses/${businessId}/parties/check-code?code=${encodeURIComponent(code)}`,
      transformResponse: (response: ApiResponse<{ exists: boolean }>) => response.data.exists,
    }),

    addSite: builder.mutation<Party, { businessId: string; partyId: string; data: AddSiteInput }>({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/sites`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [{ type: 'Party', id: partyId }, 'Party'],
    }),
  }),
});

export const {
  useGetPartiesQuery,
  useGetPartyQuery,
  useCreatePartyMutation,
  useUpdatePartyMutation,
  useDeletePartyMutation,
  useCreateAgreementMutation,
  useLazyGeneratePartyCodeQuery,
  useLazyCheckPartyCodeExistsQuery,
  useAddSiteMutation,
} = partyApi;
