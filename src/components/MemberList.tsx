/**
 * @file Member list component showing business team members.
 * Owner can edit roles and remove members.
 */
import { useState } from 'react';
import type { BusinessMember } from '../types';
import { useUpdateMemberRoleMutation, useRemoveMemberMutation } from '../api/memberApi';
import { useAuth } from '../hooks/useAuth';

interface MemberListProps {
  members: BusinessMember[];
  businessId: string;
}

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'viewer', label: 'Viewer' },
];

export function MemberList({ members, businessId }: MemberListProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();

  if (members.length === 0) {
    return <p style={{ color: '#888' }}>No members yet. Invite someone to get started.</p>;
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await updateRole({ businessId, memberId, role: newRole });
    setEditingId(null);
  };

  const handleRemove = async (memberId: string) => {
    if (window.confirm('Remove this member from the business?')) {
      await removeMember({ businessId, memberId });
    }
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Joined</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => {
          const isCurrentUser = member.userId === user?.id;
          const isOwner = member.role === 'owner';

          return (
            <tr key={member._id}>
              <td>{member.name || '—'}</td>
              <td>{member.email}</td>
              <td>
                {editingId === member._id ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member._id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`status-badge status-${member.role}`}
                    onClick={() => !isOwner && !isCurrentUser && setEditingId(member._id)}
                    style={{ cursor: !isOwner && !isCurrentUser ? 'pointer' : 'default' }}
                  >
                    {member.role}
                  </span>
                )}
              </td>
              <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
              <td>
                {!isOwner && !isCurrentUser && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemove(member._id)}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
