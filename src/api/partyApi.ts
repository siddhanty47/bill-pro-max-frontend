/**
 * Party API endpoints
 */
import { baseApi } from './baseApi';
import { fetchAllPages } from './fetchAllPages';
import type {
  Party,
  CreatePartyInput,
  CreateAgreementInput,
  AddSiteInput,
  UpdateSiteInput,
  ApiResponse,
} from '../types';

export const partyApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getParties: builder.query<Party[], string>({
      queryFn: (businessId, _api, _extra, baseQuery) =>
        fetchAllPages<Party>(`/businesses/${businessId}/parties`, baseQuery),
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
      invalidatesTags: ['Party', 'AuditLog', 'SearchIndex'],
    }),

    updateParty: builder.mutation<
      Party,
      { businessId: string; partyId: string; data: Partial<CreatePartyInput> }
    >({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'Party', id: partyId },
        'Party',
        'AuditLog',
        'SearchIndex',
      ],
    }),

    deleteParty: builder.mutation<void, { businessId: string; partyId: string }>({
      query: ({ businessId, partyId }) => ({
        url: `/businesses/${businessId}/parties/${partyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Party', 'AuditLog', 'SearchIndex'],
    }),

    createAgreement: builder.mutation<
      Party,
      { businessId: string; partyId: string; data: CreateAgreementInput }
    >({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/agreements`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'Party', id: partyId },
        'Party',
        'SearchIndex',
      ],
    }),

    generatePartyCode: builder.query<string, { businessId: string; name: string }>({
      query: ({ businessId, name }) =>
        `/businesses/${businessId}/parties/generate-code?name=${encodeURIComponent(name)}`,
      transformResponse: (response: ApiResponse<{ code: string }>) => response.data.code,
    }),

    checkPartyCodeExists: builder.query<boolean, { businessId: string; code: string }>({
      query: ({ businessId, code }) =>
        `/businesses/${businessId}/parties/check-code?code=${encodeURIComponent(code)}`,
      transformResponse: (response: ApiResponse<{ exists: boolean }>) => response.data.exists,
    }),

    addSite: builder.mutation<Party, { businessId: string; partyId: string; data: AddSiteInput }>({
      query: ({ businessId, partyId, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/sites`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'Party', id: partyId },
        'Party',
        'AuditLog',
        'SearchIndex',
      ],
    }),

    updateSite: builder.mutation<
      Party,
      { businessId: string; partyId: string; siteCode: string; data: UpdateSiteInput }
    >({
      query: ({ businessId, partyId, siteCode, data }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/sites/${encodeURIComponent(siteCode)}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Party>) => response.data,
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'Party', id: partyId },
        'Party',
        'AuditLog',
        'SearchIndex',
      ],
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
  useUpdateSiteMutation,
} = partyApi;
