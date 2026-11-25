/**
 * Year-close API endpoints (derived, read only)
 */
import { baseApi } from './baseApi';
import type { YearStatusRow, SiteClosedThrough, ApiResponse } from '../types';

export const yearCloseApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    /** Every site with an agreement active in the FY, and whether the FY is closed for it */
    getYearStatus: builder.query<YearStatusRow[], { businessId: string; fy: string }>({
      query: ({ businessId, fy }) => ({
        url: `/businesses/${businessId}/year-close`,
        params: { fy },
      }),
      transformResponse: (response: ApiResponse<YearStatusRow[]>) => response.data,
      providesTags: ['YearClose'],
    }),

    /** The site's latest closed FY, or null when none is closed */
    getSiteClosedThrough: builder.query<
      SiteClosedThrough | null,
      { businessId: string; partyId: string; agreementId: string }
    >({
      query: ({ businessId, partyId, agreementId }) => ({
        url: `/businesses/${businessId}/year-close/site`,
        params: { partyId, agreementId },
      }),
      transformResponse: (response: ApiResponse<{ closedThrough: SiteClosedThrough | null }>) =>
        response.data.closedThrough,
      providesTags: ['YearClose'],
    }),
  }),
});

export const { useGetYearStatusQuery, useGetSiteClosedThroughQuery } = yearCloseApi;
