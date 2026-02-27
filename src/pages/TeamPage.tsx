/**
 * @file Team management page.
 * Shows business members with roles and pending invitations.
 * Owner can invite members, edit roles, and remove members.
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetMembersQuery } from '../api/memberApi';
import { useGetInvitationsQuery } from '../api/invitationApi';
import { InviteModal } from '../components/InviteModal';
import { MemberList } from '../components/MemberList';
import { InvitationList } from '../components/InvitationList';
import styles from './TeamPage.module.css';

export function TeamPage() {
  const { currentBusiness } = useCurrentBusiness();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const businessId = currentBusiness?._id;

  const {
    data: membersResponse,
    isLoading: membersLoading,
  } = useGetMembersQuery(businessId!, { skip: !businessId });

  const {
    data: invitationsResponse,
    isLoading: invitationsLoading,
  } = useGetInvitationsQuery(businessId!, { skip: !businessId });

  if (!businessId) {
    return (
      <div className={styles.empty}>
        <h2>No business selected</h2>
        <p>Select or create a business to manage your team.</p>
      </div>
    );
  }

  const members = membersResponse?.data ?? [];
  const invitations = invitationsResponse?.data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team</h1>
        <button
          className="btn btn-primary"
          onClick={() => setIsInviteModalOpen(true)}
        >
          + Invite Member
        </button>
      </div>

      <section className={styles.section}>
        <h2>Members ({members.length})</h2>
        {membersLoading ? (
          <p>Loading members...</p>
        ) : (
          <MemberList members={members} businessId={businessId} />
        )}
      </section>

      <section className={styles.section}>
        <h2>Pending Invitations ({invitations.filter(i => i.status === 'pending').length})</h2>
        {invitationsLoading ? (
          <p>Loading invitations...</p>
        ) : (
          <InvitationList invitations={invitations} businessId={businessId} />
        )}
      </section>

      {isInviteModalOpen && (
        <InviteModal
          businessId={businessId}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </div>
  );
}
