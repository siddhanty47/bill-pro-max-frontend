/**
 * Bill API endpoints
 */
import { baseApi } from './baseApi';
import { fetchAllPages } from './fetchAllPages';
import { listParams, toPagedList } from './listPage';
import type {
  Bill,
  GenerateBillInput,
  BulkGenerateBillInput,
  BillGenerationResponse,
  ApiResponse,
  PaginatedResponse,
  PagedList,
  ListPageArgs,
} from '../types';

export const billApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getBills: builder.query<Bill[], string>({
      queryFn: (businessId, _api, _extra, baseQuery) =>
        fetchAllPages<Bill>(`/businesses/${businessId}/bills`, baseQuery),
      providesTags: ['Bill'],
    }),

    getBill: builder.query<Bill, { businessId: string; billId: string }>({
      query: ({ businessId, billId }) => `/businesses/${businessId}/bills/${billId}`,
      transformResponse: (response: ApiResponse<Bill>) => response.data,
      providesTags: (_result, _error, { billId }) => [{ type: 'Bill', id: billId }],
    }),

    /** One page of bills, filtered and searched on the server (Bills page). */
    getBillsPage: builder.query<PagedList<Bill>, ListPageArgs>({
      query: ({ businessId, page, pageSize, search, status }) => ({
        url: `/businesses/${businessId}/bills`,
        params: listParams({ page, pageSize, search, status }),
      }),
      transformResponse: (response: PaginatedResponse<Bill>) => toPagedList(response),
      providesTags: ['Bill'],
    }),

    getOverdueBills: builder.query<Bill[], string>({
      query: businessId => `/businesses/${businessId}/bills/overdue`,
      transformResponse: (response: ApiResponse<Bill[]>) => response.data,
      providesTags: ['Bill'],
    }),

    getBillsByParty: builder.query<Bill[], { businessId: string; partyId: string }>({
      queryFn: ({ businessId, partyId }, _api, _extra, baseQuery) =>
        fetchAllPages<Bill>(
          `/businesses/${businessId}/bills?partyId=${encodeURIComponent(partyId)}`,
          baseQuery
        ),
      providesTags: ['Bill'],
    }),

    getPaymentSummary: builder.query<
      { totalDue: number; totalPaid: number; overdue: number },
      string
    >({
      query: businessId => `/businesses/${businessId}/bills/payment-summary`,
      transformResponse: (
        response: ApiResponse<{ totalDue: number; totalPaid: number; overdue: number }>
      ) => response.data,
    }),

    getNextBillNumber: builder.query<
      string,
      { businessId: string; partyId: string; agreementId: string; periodStart: string }
    >({
      query: ({ businessId, partyId, agreementId, periodStart }) =>
        `/businesses/${businessId}/bills/next-number?partyId=${encodeURIComponent(partyId)}&agreementId=${encodeURIComponent(agreementId)}&periodStart=${encodeURIComponent(periodStart)}`,
      transformResponse: (response: ApiResponse<string>) => response.data,
      providesTags: ['Bill'],
    }),

    generateBill: builder.mutation<
      BillGenerationResponse,
      { businessId: string; data: GenerateBillInput }
    >({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/bills/generate`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<BillGenerationResponse>) => response.data,
      invalidatesTags: ['Bill', 'AuditLog', 'Dashboard'],
    }),

    bulkGenerateBills: builder.mutation<
      BillGenerationResponse,
      { businessId: string; data: BulkGenerateBillInput }
    >({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/bills/bulk-generate`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<BillGenerationResponse>) => response.data,
      invalidatesTags: ['Bill', 'AuditLog', 'Dashboard'],
    }),

    updateBillStatus: builder.mutation<
      Bill,
      { businessId: string; billId: string; status: Bill['status'] }
    >({
      query: ({ businessId, billId, status }) => ({
        url: `/businesses/${businessId}/bills/${billId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (response: ApiResponse<Bill>) => response.data,
      invalidatesTags: (_result, _error, { billId }) => [
        { type: 'Bill', id: billId },
        'Bill',
        'AuditLog',
        'Dashboard',
      ],
    }),

    /**
     * Delete a bill
     * @param force - Set to true to delete bills with any status (not just draft/cancelled)
     */
    deleteBill: builder.mutation<void, { businessId: string; billId: string; force?: boolean }>({
      query: ({ businessId, billId, force }) => ({
        url: `/businesses/${businessId}/bills/${billId}${force ? '?force=true' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Bill', 'AuditLog', 'Dashboard'],
    }),

    sendBillEmail: builder.mutation<void, { businessId: string; billId: string }>({
      query: ({ businessId, billId }) => ({
        url: `/businesses/${businessId}/bills/${billId}/send`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { billId }) => [
        { type: 'Bill', id: billId },
        'Bill',
        'Dashboard',
      ],
    }),

    /** Download bill invoice PDF */
    getBillPdf: builder.query<Blob, { businessId: string; billId: string }>({
      query: ({ businessId, billId }) => ({
        url: `/businesses/${businessId}/bills/${billId}/pdf`,
        responseHandler: response => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetBillsQuery,
  useGetBillsPageQuery,
  useLazyGetBillsPageQuery,
  useGetBillQuery,
  useGetOverdueBillsQuery,
  useGetPaymentSummaryQuery,
  useGetBillsByPartyQuery,
  useGetNextBillNumberQuery,
  useGenerateBillMutation,
  useBulkGenerateBillsMutation,
  useUpdateBillStatusMutation,
  useDeleteBillMutation,
  useSendBillEmailMutation,
  useLazyGetBillPdfQuery,
} = billApi;
