/**
 * Change rates form: closes an agreement the day before the new rates start and opens a
 * successor for the same site. Rates are prefilled with the current ones; only changed
 * rates are sent.
 */
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgreementRateWithItem, ChangeAgreementRatesInput } from '../../types';
import { Button, Field, Input, Notice, Table, TBody, THead, Td, Th, Tr } from '../ui';
import { formatDate, formatMoney } from '../../utils/format';
import styles from './ChangeRatesForm.module.css';

interface ChangeRatesFormProps {
  agreementId: string;
  /** ISO start date of the agreement being closed */
  startDate: string;
  rates: AgreementRateWithItem[];
  onSubmit: (input: ChangeAgreementRatesInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  /** Server error to show (e.g. a bill already covers the date) */
  error?: string;
}

/** "2026-09-01" -> "2026-08-31" (calendar days, no time zone) */
function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ChangeRatesForm({
  agreementId,
  startDate,
  rates,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: ChangeRatesFormProps) {
  const start = startDate.slice(0, 10);
  const schema = z.object({
    effectiveDate: z
      .string()
      .min(1, 'Pick the date the new rates start')
      .refine(v => v > start, 'Pick a date after the agreement start'),
    rates: z.array(z.object({ ratePerDay: z.number({ message: 'Enter a rate' }).min(0) })),
  });
  type FormData = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { effectiveDate: '', rates: rates.map(r => ({ ratePerDay: r.ratePerDay })) },
  });
  const effectiveDate = useWatch({ control, name: 'effectiveDate' });
  const showSummary = /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '') && effectiveDate > start;

  const submit = (data: FormData) =>
    onSubmit({
      effectiveDate: data.effectiveDate,
      rates: rates
        .map((r, i) => ({ itemId: r.itemId, ratePerDay: data.rates[i].ratePerDay }))
        .filter((r, i) => r.ratePerDay !== rates[i].ratePerDay),
    });

  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      {error && <Notice tone="danger">{error}</Notice>}

      <Field label="New rates from" required error={errors.effectiveDate?.message}>
        <Input type="date" {...register('effectiveDate')} disabled={isLoading} />
      </Field>

      {showSummary && (
        <p className={styles.summary}>
          {`Closes ${agreementId} on ${formatDate(dayBefore(effectiveDate))}, new agreement from ${formatDate(effectiveDate)}`}
        </p>
      )}

      <Table aria-label="New rates">
        <THead>
          <Tr>
            <Th>Item</Th>
            <Th align="right">Current rate</Th>
            <Th align="right">New rate</Th>
          </Tr>
        </THead>
        <TBody>
          {rates.map((r, i) => (
            <Tr key={r.itemId}>
              <Td>{r.itemName}</Td>
              <Td align="right" mono>
                {formatMoney(r.ratePerDay)}
              </Td>
              <Td align="right">
                <Input
                  mono
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={`New rate for ${r.itemName}`}
                  className={styles.rateInput}
                  invalid={Boolean(errors.rates?.[i]?.ratePerDay)}
                  {...register(`rates.${i}.ratePerDay`, { valueAsNumber: true })}
                  disabled={isLoading}
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          Change rates
        </Button>
      </div>
    </form>
  );
}
