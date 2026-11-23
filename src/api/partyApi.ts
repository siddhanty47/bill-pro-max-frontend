/**
 * Party API endpoints
 */
import { baseApi } from './baseApi';
import { fetchAllPages } from './fetchAllPages';
import type {
  Party,
  PartyOutstandingBySite,
  CreatePartyInput,
  CreateAgreementInput,
  AddSiteInput,
  UpdateSiteInput,
  ApiResponse,
  OutstandingSummary,
  PartyStockRow,
} from '../types';

export const partyApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getParties: builder.query<Party[], string>({
      queryFn: (businessId, _api, _extra, baseQuery) =>
        fetchAllPages<Party>(`/businesses/${businessId}/parties`, baseQuery),
      providesTags: ['Party'],
    }),

    /** Opening balance + bills - payments, per party and in total */
    getOutstandingSummary: builder.query<OutstandingSummary, string>({
      query: businessId => `/businesses/${businessId}/parties/outstanding`,
      transformResponse: (response: ApiResponse<OutstandingSummary>) => response.data,
      providesTags: ['Party', 'Bill', 'Payment'],
    }),

    getPartyOutstandingBySite: builder.query<
      PartyOutstandingBySite,
      { businessId: string; partyId: string }
    >({
      query: ({ businessId, partyId }) =>
        `/businesses/${businessId}/parties/${partyId}/outstanding-by-site`,
      transformResponse: (response: ApiResponse<PartyOutstandingBySite>) => response.data,
      providesTags: ['Party', 'Bill', 'Payment'],
    }),

    /** Items on this party's sites now, plus damaged or lost in the last 12 months */
    getPartyStock: builder.query<PartyStockRow[], { businessId: string; partyId: string }>({
      query: ({ businessId, partyId }) => `/businesses/${businessId}/parties/${partyId}/stock`,
      transformResponse: (response: ApiResponse<PartyStockRow[]>) => response.data,
      providesTags: (_result, _error, { partyId }) => [
        { type: 'Party', id: partyId },
        'Challan',
        'Inventory',
      ],
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
      invalidatesTags: ['Party', 'AuditLog', 'SearchIndex', 'Dashboard'],
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
        'Dashboard',
      ],
    }),

    deleteParty: builder.mutation<void, { businessId: string; partyId: string }>({
      query: ({ businessId, partyId }) => ({
        url: `/businesses/${businessId}/parties/${partyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Party', 'AuditLog', 'SearchIndex', 'Dashboard'],
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
        'Dashboard',
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
        'Dashboard',
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
        'Dashboard',
      ],
    }),
  }),
});

export const {
  useGetPartiesQuery,
  useGetPartyQuery,
  useGetPartyStockQuery,
  useGetOutstandingSummaryQuery,
  useGetPartyOutstandingBySiteQuery,
  useCreatePartyMutation,
  useUpdatePartyMutation,
  useDeletePartyMutation,
  useCreateAgreementMutation,
  useLazyGeneratePartyCodeQuery,
  useLazyCheckPartyCodeExistsQuery,
  useAddSiteMutation,
  useUpdateSiteMutation,
} = partyApi;
