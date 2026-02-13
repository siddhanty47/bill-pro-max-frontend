/**
 * Inventory API endpoints
 */
import { baseApi } from './baseApi';
import type { Inventory, CreateInventoryInput, InventoryStats, ApiResponse, PaginatedResponse } from '../types';

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query<Inventory[], string>({
      query: (businessId) => `/businesses/${businessId}/inventory`,
      transformResponse: (response: PaginatedResponse<Inventory>) => response.data,
      providesTags: ['Inventory'],
    }),

    getInventoryItem: builder.query<Inventory, { businessId: string; itemId: string }>({
      query: ({ businessId, itemId }) => `/businesses/${businessId}/inventory/${itemId}`,
      transformResponse: (response: ApiResponse<Inventory>) => response.data,
      providesTags: (_result, _error, { itemId }) => [{ type: 'Inventory', id: itemId }],
    }),

    getInventoryStats: builder.query<InventoryStats, string>({
      query: (businessId) => `/businesses/${businessId}/inventory/stats`,
      transformResponse: (response: ApiResponse<InventoryStats>) => response.data,
    }),

    getInventoryCategories: builder.query<string[], string>({
      query: (businessId) => `/businesses/${businessId}/inventory/categories`,
      transformResponse: (response: ApiResponse<string[]>) => response.data,
    }),

    createInventory: builder.mutation<Inventory, { businessId: string; data: CreateInventoryInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/inventory`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Inventory>) => response.data,
      invalidatesTags: ['Inventory'],
    }),

    updateInventory: builder.mutation<Inventory, { businessId: string; itemId: string; data: Partial<CreateInventoryInput> }>({
      query: ({ businessId, itemId, data }) => ({
        url: `/businesses/${businessId}/inventory/${itemId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: ApiResponse<Inventory>) => response.data,
      invalidatesTags: (_result, _error, { itemId }) => [{ type: 'Inventory', id: itemId }, 'Inventory'],
    }),

    checkInventoryCodeExists: builder.query<boolean, { businessId: string; code: string }>({
      query: ({ businessId, code }) => `/businesses/${businessId}/inventory/check-code?code=${encodeURIComponent(code)}`,
      transformResponse: (response: ApiResponse<{ exists: boolean }>) => response.data.exists,
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useGetInventoryItemQuery,
  useGetInventoryStatsQuery,
  useGetInventoryCategoriesQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useLazyCheckInventoryCodeExistsQuery,
} = inventoryApi;
