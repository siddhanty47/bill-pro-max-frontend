/**
 * @file Business creation form component
 * @description Form for creating a new business.
 * Supports GSTIN lookup to auto-fill business name and address.
 */
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateBusinessInput } from '../../types';
import { useLazyLookupGstinStandaloneQuery } from '../../api/gstinApi';
import styles from './BusinessForm.module.css';

const businessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gst: z.string().max(20).optional(),
  billingCycle: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  currency: z.string().max(10).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultPaymentDueDays: z.number().int().min(0).max(365).optional(),
});

type FormData = z.infer<typeof businessSchema>;

interface BusinessFormProps {
  onSubmit: (data: CreateBusinessInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BusinessForm({ onSubmit, onCancel, isLoading }: BusinessFormProps) {
  const [gstFetchError, setGstFetchError] = useState<string | null>(null);
  const [gstFetchSuccess, setGstFetchSuccess] = useState<string | null>(null);
  const [lookupGstin, { isFetching: isGstLoading }] = useLazyLookupGstinStandaloneQuery();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      billingCycle: 'monthly',
      currency: 'INR',
      defaultTaxRate: 18,
      defaultPaymentDueDays: 15,
    },
  });

  const gstValue = watch('gst') || '';

  /**
   * Handle GSTIN fetch button click.
   * Calls the standalone GSTIN lookup API and auto-fills
   * business name and address from the response.
   */
  const handleFetchGstDetails = useCallback(async () => {
    const gstin = getValues('gst')?.trim();
    if (!gstin || gstin.length !== 15) return;

    setGstFetchError(null);
    setGstFetchSuccess(null);

    try {
      const details = await lookupGstin(gstin).unwrap();

      // Auto-fill business name (prefer trade name, fall back to legal name)
      const businessName = details.tradeName || details.legalName;
      if (businessName && !getValues('name')) {
        setValue('name', businessName);
      }

      // Auto-fill address
      if (details.address) {
        setValue('address', details.address);
      }

      // Show status feedback
      if (!details.isActive) {
        setGstFetchError(`Warning: This GSTIN is ${details.status}`);
      } else {
        setGstFetchSuccess(`Fetched: ${details.legalName} (${details.status})`);
      }
    } catch (err) {
      const errorMessage =
        err && typeof err === 'object' && 'data' in err
          ? ((err as { data?: { error?: { message?: string } } }).data?.error?.message || 'Failed to fetch GST details')
          : 'Failed to fetch GST details';
      setGstFetchError(errorMessage);
    }
  }, [getValues, lookupGstin, setValue]);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      name: data.name,
      address: data.address || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      gst: data.gst || undefined,
      settings: {
        billingCycle: data.billingCycle,
        currency: data.currency || 'INR',
        defaultTaxRate: data.defaultTaxRate ?? 18,
        defaultPaymentDueDays: data.defaultPaymentDueDays ?? 15,
      },
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      {/* GST lookup at the top — enter GSTIN first to auto-fill other fields */}
      <div className="form-group">
        <label htmlFor="gst">GST Number</label>
        <div className={styles.gstRow}>
          <input
            id="gst"
            {...register('gst')}
            disabled={isLoading}
            placeholder="e.g. 22AAAAA0000A1Z5"
            className={styles.gstInput}
            maxLength={15}
          />
          <button
            type="button"
            className={`btn btn-secondary ${styles.gstFetchButton}`}
            onClick={handleFetchGstDetails}
            disabled={isLoading || isGstLoading || gstValue.trim().length !== 15}
          >
            {isGstLoading ? 'Fetching...' : 'Fetch Details'}
          </button>
        </div>
        {gstFetchError && <span className="error-message">{gstFetchError}</span>}
        {gstFetchSuccess && (
          <span className={styles.gstSuccess}>
            {gstFetchSuccess}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="name">Business Name *</label>
        <input id="name" {...register('name')} disabled={isLoading} />
        {errors.name && <span className="error-message">{errors.name.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <textarea id="address" {...register('address')} rows={2} disabled={isLoading} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input id="phone" {...register('phone')} disabled={isLoading} />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" {...register('email')} disabled={isLoading} />
          {errors.email && <span className="error-message">{errors.email.message}</span>}
        </div>
      </div>

      <h3 className={styles.sectionHeading}>Business Settings</h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="billingCycle">Billing Cycle</label>
          <select id="billingCycle" {...register('billingCycle')} disabled={isLoading}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="currency">Currency</label>
          <input id="currency" {...register('currency')} disabled={isLoading} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="defaultTaxRate">Default Tax Rate (%)</label>
          <input
            id="defaultTaxRate"
            type="number"
            step="0.01"
            {...register('defaultTaxRate', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="defaultPaymentDueDays">Payment Due Days</label>
          <input
            id="defaultPaymentDueDays"
            type="number"
            {...register('defaultPaymentDueDays', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Business'}
        </button>
      </div>
    </form>
  );
}
