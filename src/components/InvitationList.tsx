/**
 * @file Invitation list component showing pending/past invitations.
 * Owner can cancel pending invitations.
 */
import type { Invitation } from '../types';
import { useCancelInvitationMutation, useResendInvitationMutation } from '../api/invitationApi';

interface InvitationListProps {
  invitations: Invitation[];
  businessId: string;
}

export function InvitationList({ invitations, businessId }: InvitationListProps) {
  const [cancelInvitation] = useCancelInvitationMutation();
  const [resendInvitation] = useResendInvitationMutation();

  if (invitations.length === 0) {
    return <p className="text-secondary-sm">No invitations sent.</p>;
  }

  const handleCancel = async (invitationId: string) => {
    if (window.confirm('Cancel this invitation?')) {
      await cancelInvitation({ businessId, invitationId });
    }
  };

  const handleResend = async (invitationId: string) => {
    if (window.confirm('Resend this invitation?')) {
      await resendInvitation({ businessId, invitationId });
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
                <>
                  <button
                    className="btn btn-danger btn-sm btn-action-sm"
                    onClick={() => handleCancel(inv._id)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-secondary btn-sm btn-action-sm"
                    onClick={() => handleResend(inv._id)}
                  >
                    Resend
                  </button>
                </>
              )}
              {(inv.status === 'expired' || inv.status === 'cancelled') && (
                <button
                  className="btn btn-secondary btn-sm btn-action-sm"
                  onClick={() => handleResend(inv._id)}
                >
                  Resend
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
