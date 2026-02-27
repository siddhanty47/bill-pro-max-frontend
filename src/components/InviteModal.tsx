/**
 * @file Modal for inviting a new member to a business.
 * Provides email input and role selection.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCreateInvitationMutation } from '../api/invitationApi';
import { getErrorMessage } from '../api/baseApi';
import { Modal } from './Modal';

interface InviteModalProps {
  businessId: string;
  onClose: () => void;
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'viewer', label: 'Viewer' },
];

export function InviteModal({ businessId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [createInvitation, { isLoading, error }] = useCreateInvitationMutation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createInvitation({ businessId, input: { email, role } }).unwrap();
      onClose();
    } catch {
      // Error displayed via RTK Query state
    }
  };

  return (
    <Modal isOpen={true} title="Invite Team Member" onClose={onClose}>
      {error && <div className="error-message">{getErrorMessage(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="invite-email">Email Address</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isLoading}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
