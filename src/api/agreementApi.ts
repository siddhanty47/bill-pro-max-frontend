/**
 * Agreement API endpoints
 */
import { baseApi } from './baseApi';
import type { 
  AgreementWithParty, 
  UpdateAgreementInput, 
  ApiResponse,
  AgreementRateWithItem,
  AddAgreementRateInput,
  UpdateAgreementRateInput,
} from '../types';

export const agreementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all agreements for a business
     */
    getAgreements: builder.query<AgreementWithParty[], string>({
      query: (businessId) => `/businesses/${businessId}/agreements`,
      transformResponse: (response: ApiResponse<AgreementWithParty[]>) => response.data,
      providesTags: ['Agreement'],
    }),

    /**
     * Get a specific agreement by ID
     */
    getAgreement: builder.query<AgreementWithParty, { businessId: string; agreementId: string }>({
      query: ({ businessId, agreementId }) => `/businesses/${businessId}/agreements/${agreementId}`,
      transformResponse: (response: ApiResponse<AgreementWithParty>) => response.data,
      providesTags: (_result, _error, { agreementId }) => [{ type: 'Agreement', id: agreementId }],
    }),

    /**
     * Update an agreement
     */
    updateAgreement: builder.mutation<
      AgreementWithParty,
      { businessId: string; agreementId: string; data: UpdateAgreementInput }
    >({
      query: ({ businessId, agreementId, data }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<AgreementWithParty>) => response.data,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        'Agreement',
        'Party',
      ],
    }),

    /**
     * Get all rates/items for an agreement
     */
    getAgreementRates: builder.query<
      AgreementRateWithItem[],
      { businessId: string; agreementId: string }
    >({
      query: ({ businessId, agreementId }) => 
        `/businesses/${businessId}/agreements/${agreementId}/rates`,
      transformResponse: (response: ApiResponse<AgreementRateWithItem[]>) => response.data,
      providesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: `${agreementId}-rates` },
      ],
    }),

    /**
     * Add an item/rate to an agreement
     */
    addAgreementRate: builder.mutation<
      AgreementWithParty,
      { businessId: string; agreementId: string; data: AddAgreementRateInput }
    >({
      query: ({ businessId, agreementId, data }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}/rates`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<AgreementWithParty>) => response.data,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        { type: 'Agreement', id: `${agreementId}-rates` },
        'Agreement',
      ],
    }),

    /**
     * Update a rate in an agreement
     */
    updateAgreementRate: builder.mutation<
      AgreementWithParty,
      { businessId: string; agreementId: string; itemId: string; data: UpdateAgreementRateInput }
    >({
      query: ({ businessId, agreementId, itemId, data }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}/rates/${itemId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<AgreementWithParty>) => response.data,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        { type: 'Agreement', id: `${agreementId}-rates` },
        'Agreement',
      ],
    }),
  }),
});

export const {
  useGetAgreementsQuery,
  useGetAgreementQuery,
  useUpdateAgreementMutation,
  useGetAgreementRatesQuery,
  useAddAgreementRateMutation,
  useUpdateAgreementRateMutation,
} = agreementApi;
