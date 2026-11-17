/**
 * AddSiteModal component
 * Modal form for adding a new site to an existing party
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, Input, Modal, Notice, Textarea } from './ui';
import { useAddSiteMutation } from '../api/partyApi';
import type { Party } from '../types';
import styles from './AddSiteModal.module.css';

const addSiteSchema = z.object({
  code: z.string().max(20).optional(),
  address: z.string().min(1, 'Site address is required').max(500),
  stateCode: z
    .string()
    .regex(/^[0-9]{2}$/, 'State code must be 2 digits')
    .max(2)
    .optional()
    .or(z.literal('')),
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

  const defaultStateCode =
    party?.contact?.stateCode ??
    (party?.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : undefined);

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
      stateCode: defaultStateCode || '',
    },
  });

  // Reset form with party's state code when modal opens
  useEffect(() => {
    if (isOpen && party) {
      const stateCode =
        party.contact?.stateCode ??
        (party.contact?.gst?.length === 15 ? party.contact.gst.substring(0, 2) : '');
      reset({ code: '', address: '', stateCode: stateCode || '' });
    }
  }, [isOpen, party, reset]);

  const handleFormSubmit = async (data: FormData) => {
    setError(null);
    try {
      await addSite({
        businessId,
        partyId: party._id,
        data: {
          code: data.code || undefined,
          address: data.address,
          stateCode: data.stateCode?.trim() || undefined,
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
  const existingSiteCodes = party.sites.map(s => s.code).join(', ');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Add site to ${party.name}`} size="form">
      <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form} noValidate>
        {error && <Notice tone="danger">{error}</Notice>}

        <p className={styles.existing}>
          Existing sites:{' '}
          {existingSiteCodes ? <span className="mono">{existingSiteCodes}</span> : 'None'}
        </p>

        <div className={styles.columns}>
          <Field label="Site address" required error={errors.address?.message}>
            <Textarea
              {...register('address')}
              rows={3}
              disabled={isLoading}
              placeholder="Enter the site address"
            />
          </Field>
          <div className={styles.column}>
            <Field
              label="Site code"
              hint="Leave empty to auto-generate from address"
              error={errors.code?.message}
            >
              <Input mono {...register('code')} disabled={isLoading} />
            </Field>
            <Field
              label="State code"
              hint="Defaults from party state code"
              error={errors.stateCode?.message}
            >
              <Input
                mono
                inputMode="numeric"
                {...register('stateCode')}
                disabled={isLoading}
                placeholder="e.g. 27"
                maxLength={2}
              />
            </Field>
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Add site
          </Button>
        </div>
      </form>
    </Modal>
  );
}
