/**
 * AI Assistant API endpoints
 * Backend route: routes/v1/assistant.ts (POST /chat, POST /confirm, GET /conversations[...])
 * Live token streaming arrives over WebSocket; these endpoints carry the
 * authoritative final result + conversation history.
 */
import { baseApi } from './baseApi';
import type {
  ApiResponse,
  AssistantRunResult,
  AssistantConversation,
  AssistantConversationSummary,
} from '../types';

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    sendAssistantMessage: builder.mutation<
      AssistantRunResult,
      { businessId: string; message: string; conversationId?: string }
    >({
      query: ({ businessId, ...body }) => ({
        url: `/businesses/${businessId}/assistant/chat`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<AssistantRunResult>) => response.data,
      invalidatesTags: ['Assistant'],
    }),

    confirmAssistantAction: builder.mutation<
      AssistantRunResult,
      { businessId: string; conversationId: string; approve: boolean }
    >({
      query: ({ businessId, ...body }) => ({
        url: `/businesses/${businessId}/assistant/confirm`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<AssistantRunResult>) => response.data,
      invalidatesTags: ['Assistant'],
    }),

    listAssistantConversations: builder.query<AssistantConversationSummary[], string>({
      query: (businessId) => `/businesses/${businessId}/assistant/conversations`,
      transformResponse: (response: ApiResponse<AssistantConversationSummary[]>) => response.data,
      providesTags: ['Assistant'],
    }),

    getAssistantConversation: builder.query<
      AssistantConversation,
      { businessId: string; conversationId: string }
    >({
      query: ({ businessId, conversationId }) =>
        `/businesses/${businessId}/assistant/conversations/${conversationId}`,
      transformResponse: (response: ApiResponse<AssistantConversation>) => response.data,
      providesTags: (_r, _e, { conversationId }) => [{ type: 'Assistant', id: conversationId }],
    }),
  }),
});

export const {
  useSendAssistantMessageMutation,
  useConfirmAssistantActionMutation,
  useListAssistantConversationsQuery,
  useGetAssistantConversationQuery,
} = assistantApi;
