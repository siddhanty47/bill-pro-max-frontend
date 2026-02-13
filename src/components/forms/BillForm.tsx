/**
 * Bill generation form component
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, GenerateBillInput } from '../../types';

const billSchema = z.object({
  partyId: z.string().min(1, 'Select a party'),
  agreementId: z.string().min(1, 'Select an agreement'),
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  taxRate: z.number().min(0).max(100).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof billSchema>;

interface BillFormProps {
  parties: Party[];
  onSubmit: (data: GenerateBillInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BillForm({ parties, onSubmit, onCancel, isLoading }: BillFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      taxRate: 18, // Default GST rate
      discountRate: 0,
    },
  });

  const selectedPartyId = watch('partyId');
  const selectedParty = parties.find((p) => p._id === selectedPartyId);
  const activeAgreements = selectedParty?.agreements?.filter((a) => a.status === 'active') || [];

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      partyId: data.partyId,
      agreementId: data.agreementId,
      billingPeriod: {
        start: data.periodStart,
        end: data.periodEnd,
      },
      taxRate: data.taxRate,
      discountRate: data.discountRate,
      notes: data.notes || undefined,
    });
  };

  // Filter parties with active agreements
  const partiesWithAgreements = parties.filter(
    (p) => p.agreements && p.agreements.some((a) => a.status === 'active')
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="partyId">Party *</label>
          <select id="partyId" {...register('partyId')} disabled={isLoading}>
            <option value="">Select party...</option>
            {partiesWithAgreements.map((party) => (
              <option key={party._id} value={party._id}>
                {party.name}
              </option>
            ))}
          </select>
          {errors.partyId && <span className="error-message">{errors.partyId.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="agreementId">Agreement *</label>
          <select
            id="agreementId"
            {...register('agreementId')}
            disabled={isLoading || !selectedPartyId}
          >
            <option value="">Select agreement...</option>
            {activeAgreements.map((agreement) => (
              <option key={agreement.agreementId} value={agreement.agreementId}>
                {agreement.agreementId} ({agreement.terms.billingCycle})
              </option>
            ))}
          </select>
          {errors.agreementId && <span className="error-message">{errors.agreementId.message}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="periodStart">Period Start *</label>
          <input id="periodStart" type="date" {...register('periodStart')} disabled={isLoading} />
          {errors.periodStart && <span className="error-message">{errors.periodStart.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="periodEnd">Period End *</label>
          <input id="periodEnd" type="date" {...register('periodEnd')} disabled={isLoading} />
          {errors.periodEnd && <span className="error-message">{errors.periodEnd.message}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="taxRate">Tax Rate (%)</label>
          <input
            id="taxRate"
            type="number"
            step="0.01"
            {...register('taxRate', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="discountRate">Discount Rate (%)</label>
          <input
            id="discountRate"
            type="number"
            step="0.01"
            {...register('discountRate', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" {...register('notes')} rows={2} disabled={isLoading} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Bill'}
        </button>
      </div>
    </form>
  );
}
