/**
 * Challan API endpoints
 */
import { baseApi } from './baseApi';
import { downloadFile } from './downloadFile';
import { fetchAllPages } from './fetchAllPages';
import { withGate, unwrapGated, gatedTags } from './changeGate';
import { listParams, toPagedList } from './listPage';
import type {
  Challan,
  CreateChallanInput,
  DamagedItem,
  ItemWithParty,
  ExtractedChallanData,
  GateArgs,
  DryRunResult,
  ApiResponse,
  PaginatedResponse,
  PagedList,
  ListPageArgs,
} from '../types';

export const challanApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getChallans: builder.query<Challan[], string>({
      queryFn: (businessId, _api, _extra, baseQuery) =>
        fetchAllPages<Challan>(`/businesses/${businessId}/challans`, baseQuery),
      providesTags: ['Challan'],
    }),

    /** One page of challans, filtered and searched on the server (Challans page). */
    getChallansPage: builder.query<PagedList<Challan>, ListPageArgs & { type?: string }>({
      query: ({ businessId, page, pageSize, search, status, type }) => ({
        url: `/businesses/${businessId}/challans`,
        params: listParams({ page, pageSize, search, status, type }),
      }),
      transformResponse: (response: PaginatedResponse<Challan>) => toPagedList(response),
      providesTags: ['Challan'],
    }),

    getChallan: builder.query<Challan, { businessId: string; challanId: string }>({
      query: ({ businessId, challanId }) => `/businesses/${businessId}/challans/${challanId}`,
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      providesTags: (_result, _error, { challanId }) => [{ type: 'Challan', id: challanId }],
    }),

    /**
     * Gated: auto-adding an item's rate to the agreement re-prices its bills, so the server may
     * refuse it (closed year, billed month) or ask for a reason.
     */
    createChallan: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; data: CreateChallanInput } & GateArgs
    >({
      query: ({ businessId, data, ...gate }) => ({
        url: `/businesses/${businessId}/challans`,
        method: 'POST',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(() => [
        'Challan',
        'Agreement',
        'Bill',
        'BillNote',
        'Inventory',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    confirmChallan: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string; confirmedBy: string } & GateArgs
    >({
      query: ({ businessId, challanId, confirmedBy, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/confirm`,
        method: 'POST',
        ...withGate(gate, { confirmedBy }),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'Inventory',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    updateChallanItem: builder.mutation<
      Challan | DryRunResult,
      {
        businessId: string;
        challanId: string;
        itemId: string;
        quantity: number;
        /** Swap the line to this inventory item (same position) */
        newItemId?: string;
      } & GateArgs
    >({
      query: ({ businessId, challanId, itemId, quantity, newItemId, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/items/${itemId}`,
        method: 'PATCH',
        ...withGate(gate, newItemId ? { quantity, itemId: newItemId } : { quantity }),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    updateChallanTransportation: builder.mutation<
      Challan | DryRunResult,
      {
        businessId: string;
        challanId: string;
        data: {
          transporterName?: string;
          vehicleNumber?: string;
          cartageCharge?: number;
          loadingCharge?: number;
          unloadingCharge?: number;
        };
      } & GateArgs
    >({
      query: ({ businessId, challanId, data, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/transportation`,
        method: 'PATCH',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    getNextChallanNumber: builder.query<
      string,
      { businessId: string; type: 'delivery' | 'return'; date: string }
    >({
      query: ({ businessId, type, date }) =>
        `/businesses/${businessId}/challans/next-number?type=${type}&date=${date}`,
      transformResponse: (response: ApiResponse<string>) => response.data,
      providesTags: ['Challan'],
    }),

    getItemsWithParty: builder.query<
      ItemWithParty[],
      { businessId: string; partyId: string; agreementId?: string }
    >({
      query: ({ businessId, partyId, agreementId }) => {
        const base = `/businesses/${businessId}/challans/items-with-party/${partyId}`;
        return agreementId ? `${base}?agreementId=${agreementId}` : base;
      },
      transformResponse: (response: ApiResponse<ItemWithParty[]>) => response.data,
      providesTags: ['Challan'],
    }),

    addChallanItem: builder.mutation<
      Challan | DryRunResult,
      {
        businessId: string;
        challanId: string;
        data: { itemId: string; itemName: string; quantity: number };
      } & GateArgs
    >({
      query: ({ businessId, challanId, data, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/items`,
        method: 'POST',
        ...withGate(gate, data),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    /** Delete a draft challan (confirmed ones are cancelled instead) */
    deleteChallan: builder.mutation<void, { businessId: string; challanId: string }>({
      query: ({ businessId, challanId }) => ({
        url: `/businesses/${businessId}/challans/${challanId}`,
        method: 'DELETE',
      }),
      transformResponse: () => undefined,
      invalidatesTags: ['Challan', 'AuditLog', 'Dashboard'],
    }),

    /** Cancel a challan: stock reversed and bills re-checked (gated) */
    cancelChallan: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string } & GateArgs
    >({
      query: ({ businessId, challanId, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/cancel`,
        method: 'POST',
        ...withGate(gate),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
        'Inventory',
        'Party',
      ]),
    }),

    deleteChallanItem: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string; itemId: string } & GateArgs
    >({
      query: ({ businessId, challanId, itemId, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/items/${itemId}`,
        method: 'DELETE',
        ...withGate(gate),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    updateChallanDamagedItems: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string; damagedItems: DamagedItem[] } & GateArgs
    >({
      query: ({ businessId, challanId, damagedItems, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/damaged-items`,
        method: 'PUT',
        ...withGate(gate, { damagedItems }),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'Dashboard',
      ]),
    }),

    updateChallanDate: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string; date: string } & GateArgs
    >({
      query: ({ businessId, challanId, date, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/date`,
        method: 'PATCH',
        ...withGate(gate, { date }),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
        'BillNote',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    /** Every challan of a party (all sites and agreements). */
    getChallansByParty: builder.query<Challan[], { businessId: string; partyId: string }>({
      queryFn: ({ businessId, partyId }, _api, _extra, baseQuery) =>
        fetchAllPages<Challan>(
          `/businesses/${businessId}/challans?partyId=${encodeURIComponent(partyId)}`,
          baseQuery
        ),
      providesTags: ['Challan'],
    }),

    getChallansByAgreement: builder.query<Challan[], { businessId: string; agreementId: string }>({
      queryFn: ({ businessId, agreementId }, _api, _extra, baseQuery) =>
        fetchAllPages<Challan>(
          `/businesses/${businessId}/challans?agreementId=${encodeURIComponent(agreementId)}`,
          baseQuery
        ),
      providesTags: ['Challan'],
    }),

    extractChallanFromPhoto: builder.mutation<
      ExtractedChallanData,
      { businessId: string; photo: File }
    >({
      query: ({ businessId, photo }) => {
        const formData = new FormData();
        formData.append('photo', photo);
        return {
          url: `/businesses/${businessId}/challans/extract-from-photo`,
          method: 'POST',
          body: formData,
        };
      },
      transformResponse: (response: ApiResponse<ExtractedChallanData>) => response.data,
    }),

    /** Fetch the challan PDF and save it as `fileName` (the Blob stays out of the store) */
    downloadChallanPdf: builder.query<
      null,
      { businessId: string; challanId: string; fileName: string }
    >({
      queryFn: ({ businessId, challanId, fileName }, _api, _extra, baseQuery) =>
        downloadFile(`/businesses/${businessId}/challans/${challanId}/pdf`, fileName, baseQuery),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetChallansQuery,
  useGetChallansPageQuery,
  useGetChallanQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
  useUpdateChallanItemMutation,
  useUpdateChallanTransportationMutation,
  useAddChallanItemMutation,
  useDeleteChallanItemMutation,
  useDeleteChallanMutation,
  useCancelChallanMutation,
  useUpdateChallanDamagedItemsMutation,
  useUpdateChallanDateMutation,
  useGetNextChallanNumberQuery,
  useGetItemsWithPartyQuery,
  useGetChallansByAgreementQuery,
  useGetChallansByPartyQuery,
  useLazyDownloadChallanPdfQuery,
  useLazyGetChallansPageQuery,
  useExtractChallanFromPhotoMutation,
} = challanApi;
