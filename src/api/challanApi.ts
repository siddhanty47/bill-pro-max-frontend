/**
 * Challan API endpoints
 */
import { baseApi } from './baseApi';
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

    createChallan: builder.mutation<Challan, { businessId: string; data: CreateChallanInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/challans`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Challan>) => response.data,
      invalidatesTags: ['Challan', 'Inventory', 'AuditLog', 'Dashboard'],
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
        'Inventory',
        'AuditLog',
        'Dashboard',
      ]),
    }),

    updateChallanItem: builder.mutation<
      Challan | DryRunResult,
      { businessId: string; challanId: string; itemId: string; quantity: number } & GateArgs
    >({
      query: ({ businessId, challanId, itemId, quantity, ...gate }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/items/${itemId}`,
        method: 'PATCH',
        ...withGate(gate, { quantity }),
      }),
      transformResponse: unwrapGated<Challan>,
      invalidatesTags: gatedTags(({ challanId }) => [
        { type: 'Challan', id: challanId },
        'Challan',
        'Bill',
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
        'AuditLog',
        'Dashboard',
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

    /** Download challan PDF */
    getChallanPdf: builder.query<Blob, { businessId: string; challanId: string }>({
      query: ({ businessId, challanId }) => ({
        url: `/businesses/${businessId}/challans/${challanId}/pdf`,
        responseHandler: response => response.blob(),
      }),
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
  useUpdateChallanDamagedItemsMutation,
  useUpdateChallanDateMutation,
  useGetNextChallanNumberQuery,
  useGetItemsWithPartyQuery,
  useGetChallansByAgreementQuery,
  useGetChallansByPartyQuery,
  useLazyGetChallanPdfQuery,
  useLazyGetChallansPageQuery,
  useExtractChallanFromPhotoMutation,
} = challanApi;
