/**
 * Bulk bill generation form component.
 * Allows selecting shared billing params and multiple agreements.
 */
import { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgreementWithParty, BulkGenerateBillInput } from '../../types';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Fieldset,
  Input,
  Notice,
  SearchInput,
} from '../ui';
import styles from './BulkBillForm.module.css';
import { isBillableAgreement, monthEndOf, periodProblem } from '../../utils/billingPeriod';
import { formatDate } from '../../utils/format';

const bulkBillSchema = z
  .object({
    billDate: z.string().min(1, 'Bill date is required'),
    periodStart: z.string().min(1, 'Start date is required'),
    periodEnd: z.string().min(1, 'End date is required'),
    sgstRate: z.number().min(0).max(100).optional(),
    cgstRate: z.number().min(0).max(100).optional(),
    igstRate: z.number().min(0).max(100).optional(),
    discountRate: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    const problem = periodProblem(data.periodStart, data.periodEnd);
    if (problem?.level === 'error') {
      ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: problem.message });
    }
  });

type FormData = z.infer<typeof bulkBillSchema>;

interface BulkBillFormProps {
  agreements: AgreementWithParty[];
  onSubmit: (data: BulkGenerateBillInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BulkBillForm({ agreements, onSubmit, onCancel, isLoading }: BulkBillFormProps) {
  const { currentBusiness } = useCurrentBusiness();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(bulkBillSchema),
    defaultValues: {
      billDate: new Date().toISOString().split('T')[0],
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 18,
      discountRate: 0,
    },
  });

  const periodStart = useWatch({ control, name: 'periodStart' });
  const periodEnd = useWatch({ control, name: 'periodEnd' });
  const periodWarning = periodProblem(periodStart ?? '', periodEnd ?? '');

  // agreements a bill can be made for: active ones, and one closed by a rate change
  const activeAgreements = useMemo(() => agreements.filter(isBillableAgreement), [agreements]);

  // Each bill's GST follows its site: same state as the business CGST+SGST, else IGST (the server decides)
  const businessStateCode =
    currentBusiness?.stateCode ||
    (currentBusiness?.gst?.length === 15 ? currentBusiness.gst.substring(0, 2) : undefined);
  const taxLabel = (a: AgreementWithParty): string => {
    if (!businessStateCode || !a.siteStateCode) return 'CGST + SGST (state not set)';
    return a.siteStateCode === businessStateCode ? 'CGST + SGST' : 'IGST';
  };

  useEffect(() => {
    if (!currentBusiness) return;
    const settings = currentBusiness.settings;
    const legacyRate = settings.defaultTaxRate ?? 0;
    setValue('sgstRate', settings.defaultSgstRate ?? legacyRate / 2);
    setValue('cgstRate', settings.defaultCgstRate ?? legacyRate / 2);
    setValue('igstRate', settings.defaultIgstRate ?? legacyRate);
  }, [currentBusiness, setValue]);

  const filtered = useMemo(() => {
    if (!search) return activeAgreements;
    const q = search.toLowerCase();
    return activeAgreements.filter(
      a =>
        a.agreementId.toLowerCase().includes(q) ||
        a.partyName.toLowerCase().includes(q) ||
        a.siteCode.toLowerCase().includes(q) ||
        (a.siteAddress && a.siteAddress.toLowerCase().includes(q))
    );
  }, [activeAgreements, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(a => selectedIds.has(a.agreementId));

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach(a => next.delete(a.agreementId));
      } else {
        filtered.forEach(a => next.add(a.agreementId));
      }
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sanitize = (value: number | undefined): number | undefined =>
    value === undefined || Number.isNaN(value) ? undefined : value;

  const handleFormSubmit = async (data: FormData) => {
    if (selectedIds.size === 0) return;

    const selected = activeAgreements.filter(a => selectedIds.has(a.agreementId));
    const sgstRate = sanitize(data.sgstRate);
    const cgstRate = sanitize(data.cgstRate);
    const igstRate = sanitize(data.igstRate);

    await onSubmit({
      billDate: data.billDate,
      billingPeriod: {
        start: data.periodStart,
        end: data.periodEnd,
      },
      sgstRate,
      cgstRate,
      igstRate,
      discountRate: sanitize(data.discountRate),
      notes: data.notes || undefined,
      agreements: selected.map(a => ({
        partyId: a.partyId,
        agreementId: a.agreementId,
      })),
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit} className={styles.form} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Field label="Bill date" required error={errors.billDate?.message}>
            <Input type="date" {...register('billDate')} disabled={isLoading} />
          </Field>
          <div className={styles.pair}>
            <Field label="Period start" required error={errors.periodStart?.message}>
              <Input
                type="date"
                {...register('periodStart', {
                  onChange: e => {
                    const end = monthEndOf((e.target as HTMLInputElement).value);
                    if (end) setValue('periodEnd', end, { shouldValidate: true });
                  },
                })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Period end" required error={errors.periodEnd?.message}>
              <Input type="date" {...register('periodEnd')} disabled={isLoading} />
            </Field>
          </div>
          {periodWarning?.level === 'warning' && (
            <Notice tone="warning">{periodWarning.message}</Notice>
          )}
        </div>
        <div className={styles.column}>
          <div className={styles.pair}>
            <Field label="SGST (%)">
              <Input
                mono
                type="number"
                step="0.01"
                {...register('sgstRate', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
            <Field label="CGST (%)">
              <Input
                mono
                type="number"
                step="0.01"
                {...register('cgstRate', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
          </div>
          <div className={styles.pair}>
            <Field
              label="IGST (%)"
              hint="Sites in your state get CGST + SGST; sites in another state get IGST."
            >
              <Input
                mono
                type="number"
                step="0.01"
                {...register('igstRate', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
            <Field label="Discount (%)">
              <Input
                mono
                type="number"
                step="0.01"
                {...register('discountRate', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
          </div>
        </div>
      </div>

      <Fieldset legend={`Select agreements (${selectedIds.size} selected)`}>
        <div className={styles.agreementSection}>
          <div className={styles.searchRow}>
            <SearchInput
              label="Search agreements"
              placeholder="Search by party name, site, agreement ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.search}
              disabled={isLoading}
            />
            <Checkbox
              label="Select all"
              checked={allFilteredSelected}
              onChange={toggleAll}
              disabled={isLoading || filtered.length === 0}
            />
          </div>

          <Card padded={false}>
            <div className={styles.agreementList}>
              {filtered.length === 0 && (
                <EmptyState
                  title={
                    search ? 'No agreements match your search.' : 'No active agreements found.'
                  }
                />
              )}
              {filtered.map(a => (
                <Checkbox
                  key={a.agreementId}
                  checked={selectedIds.has(a.agreementId)}
                  onChange={() => toggle(a.agreementId)}
                  disabled={isLoading}
                  label={
                    <span className={styles.agreementInfo}>
                      <span className={styles.agreementSite}>
                        {a.partyName} · {a.siteCode}
                        {a.siteAddress && ` — ${a.siteAddress}`}
                      </span>
                      {a.status !== 'active' && a.endDate && (
                        <span>until {formatDate(a.endDate, { year: 'always' })}</span>
                      )}
                      <span className={`mono ${styles.agreementId}`}>{a.agreementId}</span>
                      <span className={styles.taxTag}>{taxLabel(a)}</span>
                    </span>
                  }
                />
              ))}
            </div>
          </Card>
        </div>
      </Fieldset>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          loading={isLoading}
          disabled={selectedIds.size === 0}
        >
          {`Generate ${selectedIds.size} bill${selectedIds.size !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </form>
  );
}
