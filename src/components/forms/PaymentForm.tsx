/**
 * Payment form component
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, Bill, CreatePaymentInput } from '../../types';

const paymentSchema = z.object({
  type: z.enum(['receivable', 'payable']),
  partyId: z.string().min(1, 'Select a party'),
  billId: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be positive'),
  method: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'other']),
  reference: z.string().max(100).optional(),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  parties: Party[];
  bills: Bill[];
  onSubmit: (data: CreatePaymentInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PaymentForm({ parties, bills, onSubmit, onCancel, isLoading }: PaymentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      type: 'receivable',
      method: 'bank_transfer',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedPartyId = watch('partyId');
  const paymentType = watch('type');

  // Filter bills by party (only unpaid/partial bills for receivables)
  const partyBills = bills.filter(
    (b) =>
      b.partyId === selectedPartyId &&
      (b.status === 'sent' || b.status === 'partial' || b.status === 'overdue')
  );

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      type: data.type,
      partyId: data.partyId,
      billId: data.billId || undefined,
      amount: data.amount,
      method: data.method,
      reference: data.reference || undefined,
      date: data.date,
      notes: data.notes || undefined,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="type">Payment Type *</label>
          <select id="type" {...register('type')} disabled={isLoading}>
            <option value="receivable">Receivable (from client)</option>
            <option value="payable">Payable (to supplier)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input id="date" type="date" {...register('date')} disabled={isLoading} />
          {errors.date && <span className="error-message">{errors.date.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="partyId">Party *</label>
        <select id="partyId" {...register('partyId')} disabled={isLoading}>
          <option value="">Select party...</option>
          {parties
            .filter((p) =>
              paymentType === 'receivable'
                ? p.roles.includes('client')
                : p.roles.includes('supplier')
            )
            .map((party) => (
              <option key={party._id} value={party._id}>
                {party.name}
              </option>
            ))}
        </select>
        {errors.partyId && <span className="error-message">{errors.partyId.message}</span>}
      </div>

      {paymentType === 'receivable' && partyBills.length > 0 && (
        <div className="form-group">
          <label htmlFor="billId">Link to Bill (optional)</label>
          <select id="billId" {...register('billId')} disabled={isLoading}>
            <option value="">No bill linked</option>
            {partyBills.map((bill) => (
              <option key={bill._id} value={bill._id}>
                {bill.billNumber} - ₹{(bill.totalAmount - bill.amountPaid).toLocaleString()} due
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="amount">Amount (₹) *</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.amount && <span className="error-message">{errors.amount.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="method">Payment Method *</label>
          <select id="method" {...register('method')} disabled={isLoading}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="reference">Reference / Transaction ID</label>
        <input id="reference" {...register('reference')} disabled={isLoading} />
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
          {isLoading ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}
