/**
 * @file RTK Query API for invitation management.
 */
import { baseApi } from './baseApi';
import type { ApiResponse, Invitation, CreateInvitationInput } from '../types';

export const invitationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** List invitations for a business */
    getInvitations: builder.query<ApiResponse<Invitation[]>, string>({
      query: (businessId) => `/businesses/${businessId}/invitations`,
      providesTags: (_result, _error, businessId) => [
        { type: 'Invitation' as const, id: businessId },
      ],
    }),

    /** Create a new invitation */
    createInvitation: builder.mutation<
      ApiResponse<Invitation>,
      { businessId: string; input: CreateInvitationInput }
    >({
      query: ({ businessId, input }) => ({
        url: `/businesses/${businessId}/invitations`,
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Invitation' as const, id: businessId },
      ],
    }),

    /** Update invitation role (owner only) */
    updateInvitationRole: builder.mutation<
      ApiResponse<Invitation>,
      { businessId: string; invitationId: string; role: string }
    >({
      query: ({ businessId, invitationId, role }) => ({
        url: `/businesses/${businessId}/invitations/${invitationId}`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Invitation' as const, id: businessId },
      ],
    }),

    /** Cancel an invitation */
    cancelInvitation: builder.mutation<
      ApiResponse<null>,
      { businessId: string; invitationId: string }
    >({
      query: ({ businessId, invitationId }) => ({
        url: `/businesses/${businessId}/invitations/${invitationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Invitation' as const, id: businessId },
      ],
    }),

    /** Verify an invitation token (public) */
    verifyInvitation: builder.query<ApiResponse<Invitation>, string>({
      query: (token) => `/invitations/verify/${token}`,
    }),

    /** Accept an invitation (authenticated) */
    acceptInvitation: builder.mutation<ApiResponse<null>, string>({
      query: (token) => ({
        url: `/invitations/${token}/accept`,
        method: 'POST',
      }),
      invalidatesTags: ['Business'],
    }),

    /** Decline an invitation (authenticated) */
    declineInvitation: builder.mutation<ApiResponse<null>, string>({
      query: (token) => ({
        url: `/invitations/${token}/decline`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetInvitationsQuery,
  useCreateInvitationMutation,
  useUpdateInvitationRoleMutation,
  useCancelInvitationMutation,
  useVerifyInvitationQuery,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} = invitationApi;
