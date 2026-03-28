/**
 * Audit Log API endpoints
 */
import { baseApi } from './baseApi';
import type { AuditLogEntry, PaginatedResponse } from '../types';

interface AuditHistoryParams {
  businessId: string;
  documentType: string;
  documentId: string;
  page?: number;
  pageSize?: number;
}

interface AuditHistoryResult {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const auditLogApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditHistory: builder.query<AuditHistoryResult, AuditHistoryParams>({
      query: ({ businessId, documentType, documentId, page = 1, pageSize = 20 }) =>
        `/businesses/${businessId}/audit-logs/${documentType}/${documentId}?page=${page}&pageSize=${pageSize}`,
      transformResponse: (response: PaginatedResponse<AuditLogEntry>) => ({
        data: response.data,
        pagination: response.pagination,
      }),
      providesTags: (_result, _error, { documentType, documentId }) => [
        { type: 'AuditLog' as const, id: `${documentType}-${documentId}` },
      ],
    }),
  }),
});

export const { useGetAuditHistoryQuery } = auditLogApi;
