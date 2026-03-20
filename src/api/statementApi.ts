/**
 * Statement API endpoints
 */
import { baseApi } from './baseApi';
import type { ApiResponse, StatementData } from '../types';

export interface StatementPdfParams {
  businessId: string;
  partyId: string;
  type: 'ledger' | 'bills' | 'items' | 'aging';
  from: string;
  to: string;
  agreementId?: string;
}

export const statementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStatementPdf: builder.query<Blob, StatementPdfParams>({
      query: ({ businessId, partyId, type, from, to, agreementId }) => {
        const params = new URLSearchParams({ type, from, to });
        if (agreementId) params.set('agreementId', agreementId);
        return {
          url: `/businesses/${businessId}/parties/${partyId}/statements/pdf?${params.toString()}`,
          responseHandler: (response) => response.blob(),
        };
      },
    }),

    getStatementData: builder.query<StatementData, StatementPdfParams>({
      query: ({ businessId, partyId, type, from, to, agreementId }) => {
        const params = new URLSearchParams({ type, from, to });
        if (agreementId) params.set('agreementId', agreementId);
        return `/businesses/${businessId}/parties/${partyId}/statements/data?${params.toString()}`;
      },
      transformResponse: (response: ApiResponse<StatementData>) => response.data,
    }),
  }),
});

export const { useLazyGetStatementPdfQuery, useLazyGetStatementDataQuery } = statementApi;
