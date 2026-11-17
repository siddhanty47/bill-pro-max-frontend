/**
 * Payment form component
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';
import { Button, Field, Input, Select, Textarea } from '../ui';
import styles from './PaymentForm.module.css';
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
  const [partySearchValue, setPartySearchValue] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      type: 'receivable',
      method: 'bank_transfer',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedPartyId = useWatch({ control, name: 'partyId' });
  const paymentType = useWatch({ control, name: 'type' });

  // Filter parties by payment type (client for receivable, supplier for payable)
  const filteredParties = useMemo(
    () =>
      parties.filter(p =>
        paymentType === 'receivable' ? p.roles.includes('client') : p.roles.includes('supplier')
      ),
    [parties, paymentType]
  );

  const partyAutocompleteItems: AutocompleteItem[] = useMemo(
    () =>
      filteredParties.map(party => ({
        code: party.code || party.name.substring(0, 4).toUpperCase(),
        label: party.name,
        sublabel: party.contact?.person,
        id: party._id,
      })),
    [filteredParties]
  );

  const handlePartySelect = useCallback(
    (item: AutocompleteItem) => {
      setValue('partyId', item.id);
      setValue('billId', '');
      setPartySearchValue(item.code);
    },
    [setValue]
  );

  // Sync the party search box with the selected party (adjust state during render).
  // undefined = selected party not loaded yet (leave the box alone); null = never synced.
  const selectedPartyLabel = (() => {
    if (!selectedPartyId) return '';
    const party = filteredParties.find(p => p._id === selectedPartyId);
    return party ? party.code || party.name.substring(0, 4).toUpperCase() : undefined;
  })();
  const [syncedPartyLabel, setSyncedPartyLabel] = useState<string | undefined | null>(null);
  if (selectedPartyLabel !== syncedPartyLabel) {
    setSyncedPartyLabel(selectedPartyLabel);
    if (selectedPartyLabel !== undefined) setPartySearchValue(selectedPartyLabel);
  }

  // Clear party and bill when payment type changes (not on initial mount)
  const prevPaymentTypeRef = useRef(paymentType);
  useEffect(() => {
    if (prevPaymentTypeRef.current !== paymentType) {
      prevPaymentTypeRef.current = paymentType;
      setValue('partyId', '');
      setValue('billId', '');
    }
  }, [paymentType, setValue]);

  // Filter bills by party (only unpaid/partial bills for receivables)
  const partyBills = bills.filter(
    b =>
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
    <form onSubmit={onFormSubmit} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.pair}>
            <Field label="Payment type" required>
              <Select {...register('type')} disabled={isLoading}>
                <option value="receivable">Receivable (from client)</option>
                <option value="payable">Payable (to supplier)</option>
              </Select>
            </Field>
            <Field label="Date" required error={errors.date?.message}>
              <Input type="date" {...register('date')} disabled={isLoading} />
            </Field>
          </div>

          <div>
            <CodeAutocomplete
              label="Party"
              placeholder="Type party code or name..."
              value={partySearchValue}
              onChange={setPartySearchValue}
              items={partyAutocompleteItems}
              onSelect={handlePartySelect}
              disabled={isLoading}
              error={errors.partyId?.message}
              required
            />
            <input type="hidden" {...register('partyId')} />
          </div>

          {paymentType === 'receivable' && selectedPartyId && (
            <Field label="Link to bill (optional)">
              <Select {...register('billId')} disabled={isLoading}>
                <option value="">
                  {partyBills.length > 0 ? 'No bill linked' : 'No bills available'}
                </option>
                {partyBills.map(bill => (
                  <option key={bill._id} value={bill._id}>
                    {bill.billNumber} - ₹{(bill.totalAmount - bill.amountPaid).toLocaleString()} due
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className={styles.column}>
          <div className={styles.pair}>
            <Field label="Amount (₹)" required error={errors.amount?.message}>
              <Input
                mono
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Payment method" required>
              <Select {...register('method')} disabled={isLoading}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <Field label="Reference / transaction ID" error={errors.reference?.message}>
            <Input mono {...register('reference')} disabled={isLoading} />
          </Field>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} rows={2} disabled={isLoading} />
          </Field>
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
