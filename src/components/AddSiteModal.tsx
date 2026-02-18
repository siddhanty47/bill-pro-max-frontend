/**
 * AddSiteModal component
 * Modal form for adding a new site to an existing party
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from './Modal';
import { useAddSiteMutation } from '../api/partyApi';
import type { Party } from '../types';
import styles from './AddSiteModal.module.css';

const addSiteSchema = z.object({
  code: z.string().max(20).optional(),
  address: z.string().min(1, 'Site address is required').max(500),
});

type FormData = z.infer<typeof addSiteSchema>;

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  party: Party;
}

/**
 * Modal component for adding a new site to an existing party
 * @param isOpen - Whether the modal is open
 * @param onClose - Callback to close the modal
 * @param businessId - Current business ID
 * @param party - The party to add the site to
 */
export function AddSiteModal({ isOpen, onClose, businessId, party }: AddSiteModalProps) {
  const [addSite, { isLoading }] = useAddSiteMutation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(addSiteSchema),
    defaultValues: {
      code: '',
      address: '',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    try {
      await addSite({
        businessId,
        partyId: party._id,
        data: {
          code: data.code || undefined,
          address: data.address,
        },
      }).unwrap();

      reset();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { data?: { error?: { message?: string } } };
      setError(apiError.data?.error?.message || 'Failed to add site');
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  // Get existing site codes for display
  const existingSiteCodes = party.sites.map((s) => s.code).join(', ') || 'None';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Add Site to ${party.name}`}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        {error && (
          <div className={`error-message ${styles.errorAlert}`}>
            {error}
          </div>
        )}

        <div className={`form-group ${styles.existingSitesInfo}`}>
          <p className={styles.existingSitesText}>
            <strong>Existing Sites:</strong> {existingSiteCodes}
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="siteAddress">Site Address *</label>
          <textarea
            id="siteAddress"
            {...register('address')}
            rows={3}
            disabled={isLoading}
            placeholder="Enter the site address"
          />
          {errors.address && (
            <span className="error-message">{errors.address.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="siteCode">Site Code</label>
          <input
            id="siteCode"
            {...register('code')}
            disabled={isLoading}
            className={styles.uppercaseInput}
            placeholder="Auto-generated if empty"
          />
          {errors.code && (
            <span className="error-message">{errors.code.message}</span>
          )}
          <small className={styles.helpText}>
            Leave empty to auto-generate from address
          </small>
        </div>

        <div className={`form-actions ${styles.actions}`}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Site'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
