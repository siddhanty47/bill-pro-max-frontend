/**
 * Statement API endpoints
 */
import { baseApi } from './baseApi';
import { downloadFile } from './downloadFile';
import type { ApiResponse, StatementData } from '../types';

export interface StatementPdfParams {
  businessId: string;
  partyId: string;
  type: 'ledger' | 'bills' | 'items' | 'aging';
  from: string;
  to: string;
  agreementId?: string;
  /** One site; DEFAULT_SITE_PARAM for the default site. Not combined with agreementId */
  siteCode?: string;
}

export const statementApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    /** Fetch the statement PDF and save it as `fileName` (the Blob stays out of the store) */
    downloadStatementPdf: builder.query<null, StatementPdfParams & { fileName: string }>({
      queryFn: (
        { businessId, partyId, type, from, to, agreementId, siteCode, fileName },
        _api,
        _extra,
        baseQuery
      ) => {
        const params = new URLSearchParams({ type, from, to });
        if (agreementId) params.set('agreementId', agreementId);
        if (siteCode) params.set('siteCode', siteCode);
        return downloadFile(
          `/businesses/${businessId}/parties/${partyId}/statements/pdf?${params.toString()}`,
          fileName,
          baseQuery
        );
      },
      keepUnusedDataFor: 0,
    }),

    getStatementData: builder.query<StatementData, StatementPdfParams>({
      query: ({ businessId, partyId, type, from, to, agreementId, siteCode }) => {
        const params = new URLSearchParams({ type, from, to });
        if (agreementId) params.set('agreementId', agreementId);
        if (siteCode) params.set('siteCode', siteCode);
        return `/businesses/${businessId}/parties/${partyId}/statements/data?${params.toString()}`;
      },
      transformResponse: (response: ApiResponse<StatementData>) => response.data,
    }),
  }),
});

export const { useLazyDownloadStatementPdfQuery, useLazyGetStatementDataQuery } = statementApi;
