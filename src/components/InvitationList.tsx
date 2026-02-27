/**
 * @file Invitation list component showing pending/past invitations.
 * Owner can cancel pending invitations.
 */
import type { Invitation } from '../types';
import { useCancelInvitationMutation } from '../api/invitationApi';

interface InvitationListProps {
  invitations: Invitation[];
  businessId: string;
}

export function InvitationList({ invitations, businessId }: InvitationListProps) {
  const [cancelInvitation] = useCancelInvitationMutation();

  if (invitations.length === 0) {
    return <p style={{ color: '#888' }}>No invitations sent.</p>;
  }

  const handleCancel = async (invitationId: string) => {
    if (window.confirm('Cancel this invitation?')) {
      await cancelInvitation({ businessId, invitationId });
    }
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Sent</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {invitations.map((inv) => (
          <tr key={inv._id}>
            <td>{inv.email}</td>
            <td>{inv.role}</td>
            <td>
              <span className={`status-badge status-${inv.status}`}>
                {inv.status}
              </span>
            </td>
            <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
            <td>
              {inv.status === 'pending' && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleCancel(inv._id)}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                >
                  Cancel
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
