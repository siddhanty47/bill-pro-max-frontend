/**
 * @file Member list component showing business team members.
 * Owner can edit roles and remove members.
 */
import { useState } from 'react';
import type { BusinessMember } from '../types';
import { useUpdateMemberRoleMutation, useRemoveMemberMutation } from '../api/memberApi';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/format';
import { Button, DataTable, EmptyState, RowActions, Select, StatusChip, type Column } from './ui';

interface MemberListProps {
  members: BusinessMember[];
  businessId: string;
  /** Shown as the empty-state action when there are no members. */
  onInvite?: () => void;
}

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'viewer', label: 'Viewer' },
];

export function MemberList({ members, businessId, onInvite }: MemberListProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await updateRole({ businessId, memberId, role: newRole });
    setEditingId(null);
  };

  const handleRemove = async (memberId: string) => {
    if (window.confirm('Remove this member from the business?')) {
      await removeMember({ businessId, memberId });
    }
  };

  const isManageable = (member: BusinessMember) =>
    member.role !== 'owner' && member.userId !== user?.id;

  // Only the table's select takes focus: the phone list renders the same cell, hidden by CSS.
  const roleCell = (member: BusinessMember, focus = false) =>
    editingId === member._id ? (
      <Select
        aria-label="Role"
        value={member.role}
        onChange={e => handleRoleChange(member._id, e.target.value)}
        onBlur={() => setEditingId(null)}
        autoFocus={focus}
      >
        {ROLES.map(r => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
    ) : (
      <StatusChip status={member.role} />
    );

  const actionsCell = (member: BusinessMember) =>
    isManageable(member) ? (
      <RowActions
        items={[
          {
            label: 'Change role',
            // Defer so the menu's focus-return to its trigger doesn't blur the new select.
            onClick: () => setTimeout(() => setEditingId(member._id), 0),
          },
          { label: 'Remove', onClick: () => handleRemove(member._id), tone: 'danger' },
        ]}
      />
    ) : null;

  const columns: Column<BusinessMember>[] = [
    { key: 'name', header: 'Name', render: m => m.name || '—' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', nowrap: true, render: m => roleCell(m, true) },
    { key: 'joinedAt', header: 'Joined', nowrap: true, render: m => formatDate(m.joinedAt) },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: actionsCell },
  ];

  return (
    <DataTable
      aria-label="Members"
      columns={columns}
      rows={members}
      rowKey={m => m._id}
      empty={
        <EmptyState
          title="No members yet"
          action={
            onInvite && (
              <Button variant="primary" icon="plus" onClick={onInvite}>
                Invite member
              </Button>
            )
          }
        />
      }
      mobile={{
        title: m => m.name || m.email,
        subtitle: m => (m.name ? m.email : undefined),
        badge: m => roleCell(m),
        meta: m => [`Joined ${formatDate(m.joinedAt)}`],
        actions: actionsCell,
        actionsPlacement: 'trailing',
      }}
    />
  );
}
