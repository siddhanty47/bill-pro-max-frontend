/**
 * Global search API endpoints
 */
import { baseApi } from './baseApi';
import type { ApiResponse, SearchIndexResponse, DocumentSearchResponse } from '../types';

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSearchIndex: builder.query<SearchIndexResponse, { businessId: string }>({
      query: ({ businessId }) => `/businesses/${businessId}/search/index`,
      transformResponse: (response: ApiResponse<SearchIndexResponse>) => response.data,
      providesTags: ['SearchIndex'],
    }),
    searchDocuments: builder.query<DocumentSearchResponse, { businessId: string; q: string }>({
      query: ({ businessId, q }) => `/businesses/${businessId}/search/documents?q=${encodeURIComponent(q)}`,
      transformResponse: (response: ApiResponse<DocumentSearchResponse>) => response.data,
      keepUnusedDataFor: 30,
    }),
  }),
});

export const { useGetSearchIndexQuery, useSearchDocumentsQuery } = searchApi;
