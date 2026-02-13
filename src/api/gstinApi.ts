/**
 * @file GSTIN Lookup API endpoints
 * @description RTK Query endpoints for fetching GST registration details.
 * Provides two variants:
 * - Business-scoped lookup (for PartyForm, when businessId is available)
 * - Standalone lookup (for BusinessForm, when no businessId exists yet)
 */

import { baseApi } from './baseApi';
import type { GstinDetails, ApiResponse } from '../types';

export const gstinApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Lookup GSTIN details (business-scoped).
     * Used by PartyForm when a businessId is available.
     */
    lookupGstin: builder.query<GstinDetails, { businessId: string; gstin: string }>({
      query: ({ businessId, gstin }) =>
        `/businesses/${businessId}/gstin/${encodeURIComponent(gstin)}`,
      transformResponse: (response: ApiResponse<GstinDetails>) => response.data,
    }),

    /**
     * Lookup GSTIN details (standalone, auth-only).
     * Used by BusinessForm when creating a new business
     * and no businessId is available yet.
     */
    lookupGstinStandalone: builder.query<GstinDetails, string>({
      query: (gstin) => `/gstin/${encodeURIComponent(gstin)}`,
      transformResponse: (response: ApiResponse<GstinDetails>) => response.data,
    }),
  }),
});

export const { useLazyLookupGstinQuery, useLazyLookupGstinStandaloneQuery } = gstinApi;
