/**
 * @file RTK Query API for in-app notifications.
 * Uses polling for unread count to provide near-realtime notification updates.
 */
import { baseApi } from './baseApi';
import type { ApiResponse, AppNotification } from '../types';

interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** Get paginated notifications for the current user */
    getNotifications: builder.query<
      ApiResponse<AppNotification[]>,
      { limit?: number; offset?: number } | void
    >({
      query: (params) => ({
        url: '/notifications',
        params: params ?? undefined,
      }),
      providesTags: ['Notification'],
    }),

    /** Get unread notification count (polled every 30s) */
    getUnreadCount: builder.query<UnreadCountResponse, void>({
      query: () => '/notifications/unread-count',
      providesTags: ['Notification'],
    }),

    /** Mark a single notification as read */
    markAsRead: builder.mutation<ApiResponse<null>, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Notification'],
    }),

    /** Mark all notifications as read */
    markAllAsRead: builder.mutation<ApiResponse<null>, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PATCH',
      }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationApi;
