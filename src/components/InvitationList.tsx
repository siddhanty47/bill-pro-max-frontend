/**
 * @file Invitation list component showing pending/past invitations.
 * Owner can cancel pending invitations.
 */
import type { Invitation } from '../types';
import { useCancelInvitationMutation, useResendInvitationMutation } from '../api/invitationApi';
import { formatDate } from '../utils/format';
import { Button, DataTable, EmptyState, RowActions, StatusChip, type Column } from './ui';
import { roleTone } from './ui/status';

interface InvitationListProps {
  invitations: Invitation[];
  businessId: string;
}

export function InvitationList({ invitations, businessId }: InvitationListProps) {
  const [cancelInvitation] = useCancelInvitationMutation();
  const [resendInvitation] = useResendInvitationMutation();

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

  const actionsCell = (inv: Invitation) => {
    const canResend =
      inv.status === 'pending' || inv.status === 'expired' || inv.status === 'cancelled';
    if (!canResend) return null;
    return (
      <RowActions
        primary={
          <Button size="sm" onClick={() => handleResend(inv._id)}>
            Resend
          </Button>
        }
        items={
          inv.status === 'pending'
            ? [
                {
                  label: 'Cancel invitation',
                  onClick: () => handleCancel(inv._id),
                  tone: 'danger',
                },
              ]
            : []
        }
      />
    );
  };

  const columns: Column<Invitation>[] = [
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      nowrap: true,
      render: inv => <StatusChip status={inv.role} tone={roleTone(inv.role)} />,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: inv => <StatusChip status={inv.status} />,
    },
    { key: 'createdAt', header: 'Sent', nowrap: true, render: inv => formatDate(inv.createdAt) },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: actionsCell },
  ];

  return (
    <DataTable
      aria-label="Invitations"
      columns={columns}
      rows={invitations}
      rowKey={inv => inv._id}
      empty={<EmptyState title="No invitations sent" />}
      mobile={{
        title: inv => inv.email,
        badge: inv => <StatusChip status={inv.status} />,
        meta: inv => [
          <StatusChip key="role" status={inv.role} />,
          `Sent ${formatDate(inv.createdAt)}`,
        ],
        actions: actionsCell,
      }}
    />
  );
}
