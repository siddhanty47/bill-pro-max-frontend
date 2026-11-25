/**
 * @file RTK Query API for share link management and public portal.
 */
import { baseApi } from './baseApi';
import { downloadFile } from './downloadFile';
import type {
  ApiResponse,
  ShareLink,
  CreateShareLinkInput,
  UpdateShareLinkInput,
  PortalInfo,
  PortalSummary,
  PortalChallan,
  PortalBill,
  PortalNote,
  PortalRunningItem,
  PortalPayment,
  PaginatedResponse,
} from '../types';

export const shareLinkApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    /** List share links for a party */
    getShareLinks: builder.query<ApiResponse<ShareLink[]>, { businessId: string; partyId: string }>(
      {
        query: ({ businessId, partyId }) =>
          `/businesses/${businessId}/parties/${partyId}/share-links`,
        providesTags: (_result, _error, { partyId }) => [
          { type: 'ShareLink' as const, id: partyId },
        ],
      }
    ),

    /** Create a new share link */
    createShareLink: builder.mutation<
      ApiResponse<ShareLink>,
      { businessId: string; partyId: string; input: CreateShareLinkInput }
    >({
      query: ({ businessId, partyId, input }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/share-links`,
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'ShareLink' as const, id: partyId },
      ],
    }),

    /** Update a share link */
    updateShareLink: builder.mutation<
      ApiResponse<ShareLink>,
      { businessId: string; partyId: string; linkId: string; input: UpdateShareLinkInput }
    >({
      query: ({ businessId, partyId, linkId, input }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/share-links/${linkId}`,
        method: 'PATCH',
        body: input,
      }),
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'ShareLink' as const, id: partyId },
      ],
    }),

    /** Revoke a share link */
    revokeShareLink: builder.mutation<
      ApiResponse<null>,
      { businessId: string; partyId: string; linkId: string }
    >({
      query: ({ businessId, partyId, linkId }) => ({
        url: `/businesses/${businessId}/parties/${partyId}/share-links/${linkId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { partyId }) => [
        { type: 'ShareLink' as const, id: partyId },
      ],
    }),

    // ─── Portal endpoints (public, no auth) ────────────────────────

    /** Get portal info */
    getPortalInfo: builder.query<ApiResponse<PortalInfo>, string>({
      query: token => `/share/${token}`,
    }),

    /** Get portal challans */
    getPortalChallans: builder.query<
      {
        success: boolean;
        data: PortalChallan[];
        pagination: PaginatedResponse<PortalChallan>['pagination'];
      },
      { token: string; type?: string; page?: number; pageSize?: number }
    >({
      query: ({ token, ...params }) => {
        const searchParams = new URLSearchParams();
        if (params.type) searchParams.set('type', params.type);
        if (params.page) searchParams.set('page', String(params.page));
        if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
        const qs = searchParams.toString();
        return `/share/${token}/challans${qs ? `?${qs}` : ''}`;
      },
    }),

    /** Get portal running items */
    getPortalRunningItems: builder.query<ApiResponse<PortalRunningItem[]>, string>({
      query: token => `/share/${token}/running-items`,
    }),

    /** Get portal bills */
    getPortalBills: builder.query<
      {
        success: boolean;
        data: PortalBill[];
        pagination: PaginatedResponse<PortalBill>['pagination'];
      },
      { token: string; status?: string; page?: number; pageSize?: number }
    >({
      query: ({ token, ...params }) => {
        const searchParams = new URLSearchParams();
        if (params.status) searchParams.set('status', params.status);
        if (params.page) searchParams.set('page', String(params.page));
        if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
        const qs = searchParams.toString();
        return `/share/${token}/bills${qs ? `?${qs}` : ''}`;
      },
    }),

    /** Get portal credit/debit notes (issued only) */
    getPortalNotes: builder.query<
      {
        success: boolean;
        data: PortalNote[];
        pagination: PaginatedResponse<PortalNote>['pagination'];
      },
      { token: string; page?: number; pageSize?: number }
    >({
      query: ({ token, ...params }) => {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.set('page', String(params.page));
        if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
        const qs = searchParams.toString();
        return `/share/${token}/notes${qs ? `?${qs}` : ''}`;
      },
    }),

    /** Get portal payments */
    getPortalPayments: builder.query<
      {
        success: boolean;
        data: PortalPayment[];
        pagination: PaginatedResponse<PortalPayment>['pagination'];
      },
      { token: string; page?: number; pageSize?: number }
    >({
      query: ({ token, ...params }) => {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.set('page', String(params.page));
        if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
        const qs = searchParams.toString();
        return `/share/${token}/payments${qs ? `?${qs}` : ''}`;
      },
    }),

    /** Get portal summary */
    getPortalSummary: builder.query<ApiResponse<PortalSummary>, string>({
      query: token => `/share/${token}/summary`,
    }),

    // PDFs: fetched and saved as `fileName`; the Blob stays out of the store (data is null)

    /** Download portal challan PDF */
    downloadPortalChallanPdf: builder.query<
      null,
      { token: string; challanId: string; fileName: string }
    >({
      queryFn: ({ token, challanId, fileName }, _api, _extra, baseQuery) =>
        downloadFile(`/share/${token}/challans/${challanId}/pdf`, fileName, baseQuery),
      keepUnusedDataFor: 0,
    }),

    /** Download portal bill PDF */
    downloadPortalBillPdf: builder.query<null, { token: string; billId: string; fileName: string }>(
      {
        queryFn: ({ token, billId, fileName }, _api, _extra, baseQuery) =>
          downloadFile(`/share/${token}/bills/${billId}/pdf`, fileName, baseQuery),
        keepUnusedDataFor: 0,
      }
    ),

    /** Download portal credit/debit note PDF */
    downloadPortalNotePdf: builder.query<null, { token: string; noteId: string; fileName: string }>(
      {
        queryFn: ({ token, noteId, fileName }, _api, _extra, baseQuery) =>
          downloadFile(`/share/${token}/notes/${noteId}/pdf`, fileName, baseQuery),
        keepUnusedDataFor: 0,
      }
    ),
  }),
});

export const {
  useGetShareLinksQuery,
  useCreateShareLinkMutation,
  useUpdateShareLinkMutation,
  useRevokeShareLinkMutation,
  useGetPortalInfoQuery,
  useGetPortalChallansQuery,
  useGetPortalRunningItemsQuery,
  useGetPortalBillsQuery,
  useGetPortalNotesQuery,
  useGetPortalPaymentsQuery,
  useGetPortalSummaryQuery,
  useLazyDownloadPortalChallanPdfQuery,
  useLazyDownloadPortalBillPdfQuery,
  useLazyDownloadPortalNotePdfQuery,
} = shareLinkApi;
