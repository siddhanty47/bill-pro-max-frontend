/**
 * Edit Agreement Form component
 * Form for editing existing agreements (status, terms, dates)
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgreementWithParty, UpdateAgreementInput } from '../../types';

const editAgreementSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  status: z.enum(['active', 'expired', 'terminated']),
  billingCycle: z.enum(['monthly', 'weekly', 'yearly']),
  paymentDueDays: z.number().int().min(0).max(365),
  securityDeposit: z.number().min(0).optional(),
});

type FormData = z.infer<typeof editAgreementSchema>;

interface EditAgreementFormProps {
  agreement: AgreementWithParty;
  onSubmit: (data: UpdateAgreementInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * EditAgreementForm component
 * Allows editing of agreement status, terms, and dates
 */
export function EditAgreementForm({
  agreement,
  onSubmit,
  onCancel,
  isLoading,
}: EditAgreementFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(editAgreementSchema),
    defaultValues: {
      startDate: agreement.startDate ? agreement.startDate.split('T')[0] : '',
      endDate: agreement.endDate ? agreement.endDate.split('T')[0] : '',
      status: agreement.status,
      billingCycle: agreement.terms.billingCycle,
      paymentDueDays: agreement.terms.paymentDueDays,
      securityDeposit: agreement.terms.securityDeposit,
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    const updateData: UpdateAgreementInput = {
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      status: data.status,
      terms: {
        billingCycle: data.billingCycle,
        paymentDueDays: data.paymentDueDays,
        securityDeposit: data.securityDeposit,
      },
    };
    await onSubmit(updateData);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit} className="form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="agreementId">Agreement ID</label>
          <input
            id="agreementId"
            type="text"
            value={agreement.agreementId}
            disabled
            className="input-disabled"
          />
        </div>

        <div className="form-group">
          <label htmlFor="partyName">Party</label>
          <input
            id="partyName"
            type="text"
            value={agreement.partyName}
            disabled
            className="input-disabled"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startDate">Start Date *</label>
          <input
            id="startDate"
            type="date"
            {...register('startDate')}
            disabled={isLoading}
          />
          {errors.startDate && <span className="error">{errors.startDate.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            {...register('endDate')}
            disabled={isLoading}
          />
          {errors.endDate && <span className="error">{errors.endDate.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="status">Status *</label>
        <select id="status" {...register('status')} disabled={isLoading}>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
        {errors.status && <span className="error">{errors.status.message}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="billingCycle">Billing Cycle *</label>
          <select id="billingCycle" {...register('billingCycle')} disabled={isLoading}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
          </select>
          {errors.billingCycle && <span className="error">{errors.billingCycle.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="paymentDueDays">Payment Due Days *</label>
          <input
            id="paymentDueDays"
            type="number"
            {...register('paymentDueDays', { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.paymentDueDays && <span className="error">{errors.paymentDueDays.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="securityDeposit">Security Deposit</label>
        <input
          id="securityDeposit"
          type="number"
          {...register('securityDeposit', { valueAsNumber: true })}
          disabled={isLoading}
        />
        {errors.securityDeposit && <span className="error">{errors.securityDeposit.message}</span>}
      </div>

      <div className="form-info">
        <p><strong>Item Rates:</strong> {agreement.rates.length} items configured</p>
        <p className="text-muted">Note: Item rates cannot be modified after creation.</p>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={isLoading} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="btn btn-primary">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
