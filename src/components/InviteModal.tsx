/**
 * @file Modal for inviting a new member to a business.
 * Provides email input and role selection.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCreateInvitationMutation } from '../api/invitationApi';
import { getErrorMessage } from '../api/baseApi';
import { Button, Field, Input, Modal, Notice, Select } from './ui';
import styles from './InviteModal.module.css';

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
    <Modal isOpen={true} title="Invite team member" onClose={onClose} size="form">
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <Notice tone="danger">{getErrorMessage(error)}</Notice>}

        <div className={styles.pair}>
          <Field label="Email address" required>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              disabled={isLoading}
            />
          </Field>

          <Field label="Role">
            <Select value={role} onChange={e => setRole(e.target.value)} disabled={isLoading}>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className={styles.actions}>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Send invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
