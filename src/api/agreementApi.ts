/**
 * Agreement API endpoints
 */
import { baseApi } from './baseApi';
import { withGate, unwrapGated } from './changeGate';
import type {
  AgreementWithParty,
  UpdateAgreementInput,
  ApiResponse,
  AgreementRateWithItem,
  AddAgreementRateInput,
  UpdateAgreementRateInput,
  ChangeAgreementRatesInput,
  GateArgs,
  DryRunResult,
} from '../types';

export const agreementApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    /**
     * Get all agreements for a business
     */
    getAgreements: builder.query<AgreementWithParty[], string>({
      query: businessId => `/businesses/${businessId}/agreements?pageSize=100`,
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
      AgreementWithParty | DryRunResult,
      { businessId: string; agreementId: string; data: UpdateAgreementInput } & GateArgs
    >({
      query: ({ businessId, agreementId, data, ...gate }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}`,
        method: 'PATCH',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<AgreementWithParty>,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        'Agreement',
        'Party',
        'AuditLog',
        'SearchIndex',
        'Dashboard',
      ],
    }),

    /**
     * Change rates: closes the agreement the day before `effectiveDate` and opens a successor
     * for the same site. Returns both.
     */
    changeAgreementRates: builder.mutation<
      { previous: AgreementWithParty; agreement: AgreementWithParty } | DryRunResult,
      { businessId: string; agreementId: string; data: ChangeAgreementRatesInput } & GateArgs
    >({
      query: ({ businessId, agreementId, data, ...gate }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}/change-rates`,
        method: 'POST',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<{
        previous: AgreementWithParty;
        agreement: AgreementWithParty;
      }>,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        'Agreement',
        'Party',
        'Bill',
        'AuditLog',
        'SearchIndex',
        'Dashboard',
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
      AgreementWithParty | DryRunResult,
      { businessId: string; agreementId: string; data: AddAgreementRateInput } & GateArgs
    >({
      query: ({ businessId, agreementId, data, ...gate }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}/rates`,
        method: 'POST',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<AgreementWithParty>,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        { type: 'Agreement', id: `${agreementId}-rates` },
        'Agreement',
        'AuditLog',
        'Dashboard',
      ],
    }),

    /**
     * Update a rate in an agreement
     */
    updateAgreementRate: builder.mutation<
      AgreementWithParty | DryRunResult,
      {
        businessId: string;
        agreementId: string;
        itemId: string;
        data: UpdateAgreementRateInput;
      } & GateArgs
    >({
      query: ({ businessId, agreementId, itemId, data, ...gate }) => ({
        url: `/businesses/${businessId}/agreements/${agreementId}/rates/${itemId}`,
        method: 'PATCH',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<AgreementWithParty>,
      invalidatesTags: (_result, _error, { agreementId }) => [
        { type: 'Agreement', id: agreementId },
        { type: 'Agreement', id: `${agreementId}-rates` },
        'Agreement',
        'AuditLog',
        'Dashboard',
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
  useChangeAgreementRatesMutation,
} = agreementApi;
