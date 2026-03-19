/**
 * Inventory Preset API endpoints
 */
import { baseApi } from './baseApi';
import type {
  PresetSummary,
  InventoryPreset,
  ImportPresetResult,
  CreatePresetInput,
  ApiResponse,
} from '../types';

export const presetApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPresets: builder.query<PresetSummary[], void>({
      query: () => '/presets',
      transformResponse: (response: ApiResponse<PresetSummary[]>) => response.data,
      providesTags: ['Preset'],
    }),

    getPresetById: builder.query<InventoryPreset, string>({
      query: (id) => `/presets/${id}`,
      transformResponse: (response: ApiResponse<InventoryPreset>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Preset', id }],
    }),

    importPreset: builder.mutation<ImportPresetResult, { businessId: string; presetId: string }>({
      query: ({ businessId, presetId }) => ({
        url: `/businesses/${businessId}/inventory/import-preset`,
        method: 'POST',
        body: { presetId },
      }),
      transformResponse: (response: ApiResponse<ImportPresetResult>) => response.data,
      invalidatesTags: ['Inventory'],
    }),

    createPreset: builder.mutation<InventoryPreset, { businessId: string; data: CreatePresetInput }>({
      query: ({ businessId, data }) => ({
        url: `/businesses/${businessId}/presets`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<InventoryPreset>) => response.data,
      invalidatesTags: ['Preset'],
    }),
  }),
});

export const {
  useGetPresetsQuery,
  useGetPresetByIdQuery,
  useLazyGetPresetByIdQuery,
  useImportPresetMutation,
  useCreatePresetMutation,
} = presetApi;
