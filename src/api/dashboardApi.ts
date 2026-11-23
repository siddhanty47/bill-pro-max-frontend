/**
 * Dashboard insights API endpoints
 */
import { baseApi } from './baseApi';
import type {
  ApiResponse,
  DashboardMetric,
  DashboardSummary,
  NavCounts,
  RangeKey,
  SeriesResponse,
} from '../types';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getNavCounts: builder.query<NavCounts, string>({
      query: businessId => `/businesses/${businessId}/dashboard/nav-counts`,
      transformResponse: (response: ApiResponse<NavCounts>) => response.data,
      providesTags: ['Dashboard'],
    }),

    getDashboardSummary: builder.query<DashboardSummary, string>({
      query: businessId => `/businesses/${businessId}/dashboard/summary`,
      transformResponse: (response: ApiResponse<DashboardSummary>) => response.data,
      providesTags: ['Dashboard'],
    }),

    getDashboardSeries: builder.query<
      SeriesResponse,
      { businessId: string; metric: DashboardMetric; range: RangeKey }
    >({
      query: ({ businessId, metric, range }) =>
        `/businesses/${businessId}/dashboard/series?metric=${metric}&range=${range}`,
      transformResponse: (response: ApiResponse<SeriesResponse>) => response.data,
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetNavCountsQuery, useGetDashboardSummaryQuery, useGetDashboardSeriesQuery } =
  dashboardApi;
