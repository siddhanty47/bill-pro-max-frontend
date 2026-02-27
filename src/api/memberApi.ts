/**
 * @file RTK Query API for business member management.
 */
import { baseApi } from './baseApi';
import type { ApiResponse, BusinessMember } from '../types';

export const memberApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** List all members of a business */
    getMembers: builder.query<ApiResponse<BusinessMember[]>, string>({
      query: (businessId) => `/businesses/${businessId}/members`,
      providesTags: (_result, _error, businessId) => [
        { type: 'Member' as const, id: businessId },
      ],
    }),

    /** Update a member's role */
    updateMemberRole: builder.mutation<
      ApiResponse<BusinessMember>,
      { businessId: string; memberId: string; role: string }
    >({
      query: ({ businessId, memberId, role }) => ({
        url: `/businesses/${businessId}/members/${memberId}`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Member' as const, id: businessId },
      ],
    }),

    /** Remove a member from the business */
    removeMember: builder.mutation<
      ApiResponse<null>,
      { businessId: string; memberId: string }
    >({
      query: ({ businessId, memberId }) => ({
        url: `/businesses/${businessId}/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Member' as const, id: businessId },
      ],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} = memberApi;
