/**
 * Credit/debit note API endpoints
 */
import { baseApi } from './baseApi';
import { fetchAllPages } from './fetchAllPages';
import { listParams, toPagedList } from './listPage';
import { downloadFile } from './downloadFile';
import type {
  BillNote,
  BillNoteListArgs,
  BillNoteFilters,
  CreateBillNoteInput,
  UpdateBillNoteInput,
  ApiResponse,
  PaginatedResponse,
  PagedList,
} from '../types';

/** Everything a note change can move: bills, balances, statements, nav counts (Dashboard). */
const NOTE_MUTATION_TAGS = ['BillNote', 'Bill', 'AuditLog', 'Dashboard'] as const;

export const billNoteApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    /** One page of notes, filtered on the server */
    getBillNotes: builder.query<PagedList<BillNote>, BillNoteListArgs>({
      query: ({ businessId, page, pageSize, partyId, billId, status, type, source }) => ({
        url: `/businesses/${businessId}/bill-notes`,
        params: listParams({ page, pageSize, partyId, billId, status, type, source }),
      }),
      transformResponse: (response: PaginatedResponse<BillNote>) => toPagedList(response),
      providesTags: ['BillNote'],
    }),

    /**
     * Every note matching the filters (all backend pages). The Notes page searches these in the
     * browser: the notes endpoint has no text search.
     */
    getAllBillNotes: builder.query<BillNote[], BillNoteFilters>({
      queryFn: ({ businessId, ...filters }, _api, _extra, baseQuery) => {
        const query = new URLSearchParams(listParams(filters) as Record<string, string>).toString();
        const url = `/businesses/${businessId}/bill-notes${query ? `?${query}` : ''}`;
        return fetchAllPages<BillNote>(url, baseQuery);
      },
      providesTags: ['BillNote'],
    }),

    getBillNote: builder.query<BillNote, { businessId: string; noteId: string }>({
      query: ({ businessId, noteId }) => `/businesses/${businessId}/bill-notes/${noteId}`,
      transformResponse: (response: ApiResponse<BillNote>) => response.data,
      providesTags: (_result, _error, { noteId }) => [{ type: 'BillNote', id: noteId }],
    }),

    /** Create a manual draft note against an issued bill */
    createBillNote: builder.mutation<BillNote, { businessId: string; data: CreateBillNoteInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/bill-notes`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<BillNote>) => response.data,
      invalidatesTags: [...NOTE_MUTATION_TAGS],
    }),

    /** Edit a draft note's reason / lines */
    updateBillNote: builder.mutation<
      BillNote,
      { businessId: string; noteId: string; data: UpdateBillNoteInput }
    >({
      query: ({ businessId, noteId, data }) => ({
        url: `/businesses/${businessId}/bill-notes/${noteId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<BillNote>) => response.data,
      invalidatesTags: (_result, _error, { noteId }) => [
        { type: 'BillNote', id: noteId },
        ...NOTE_MUTATION_TAGS,
      ],
    }),

    issueBillNote: builder.mutation<BillNote, { businessId: string; noteId: string }>({
      query: ({ businessId, noteId }) => ({
        url: `/businesses/${businessId}/bill-notes/${noteId}/issue`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<BillNote>) => response.data,
      invalidatesTags: (_result, _error, { noteId }) => [
        { type: 'BillNote', id: noteId },
        ...NOTE_MUTATION_TAGS,
      ],
    }),

    /** Cancel a draft note (issued notes can never be cancelled) */
    cancelBillNote: builder.mutation<BillNote, { businessId: string; noteId: string }>({
      query: ({ businessId, noteId }) => ({
        url: `/businesses/${businessId}/bill-notes/${noteId}/cancel`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<BillNote>) => response.data,
      invalidatesTags: (_result, _error, { noteId }) => [
        { type: 'BillNote', id: noteId },
        ...NOTE_MUTATION_TAGS,
      ],
    }),

    /** Email an issued note to the party */
    sendBillNote: builder.mutation<void, { businessId: string; noteId: string }>({
      query: ({ businessId, noteId }) => ({
        url: `/businesses/${businessId}/bill-notes/${noteId}/send`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { noteId }) => [{ type: 'BillNote', id: noteId }],
    }),

    /**
     * Fetch the note PDF and save it as `fileName`. The Blob never reaches the store (it is not
     * serializable): the query's data is `null`. Re-run with the lazy trigger for each download.
     */
    downloadBillNotePdf: builder.query<
      null,
      { businessId: string; noteId: string; fileName: string }
    >({
      queryFn: ({ businessId, noteId, fileName }, _api, _extra, baseQuery) =>
        downloadFile(`/businesses/${businessId}/bill-notes/${noteId}/pdf`, fileName, baseQuery),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetBillNotesQuery,
  useGetAllBillNotesQuery,
  useGetBillNoteQuery,
  useCreateBillNoteMutation,
  useUpdateBillNoteMutation,
  useIssueBillNoteMutation,
  useCancelBillNoteMutation,
  useSendBillNoteMutation,
  useLazyDownloadBillNotePdfQuery,
} = billNoteApi;
