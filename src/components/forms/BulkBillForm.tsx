/**
 * Bulk bill generation form component.
 * Allows selecting shared billing params and multiple agreements.
 */
import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgreementWithParty, BulkGenerateBillInput } from '../../types';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import styles from './BulkBillForm.module.css';

const bulkBillSchema = z.object({
  billDate: z.string().min(1, 'Bill date is required'),
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  taxMode: z.enum(['intra', 'inter']),
  sgstRate: z.number().min(0).max(100).optional(),
  cgstRate: z.number().min(0).max(100).optional(),
  igstRate: z.number().min(0).max(100).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
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
    register,
    handleSubmit,
    watch,
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
      taxMode: 'intra',
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 18,
      discountRate: 0,
    },
  });

  const taxMode = watch('taxMode');

  const activeAgreements = useMemo(
    () => agreements.filter(a => a.status === 'active'),
    [agreements],
  );

  // Auto-select tax mode based on business and selected agreements' site state codes
  useEffect(() => {
    if (!currentBusiness || selectedIds.size === 0) return;
    const businessStateCode = currentBusiness.stateCode ?? (currentBusiness.gst?.length === 15 ? currentBusiness.gst.substring(0, 2) : undefined);
    const selectedAgreements = activeAgreements.filter(a => selectedIds.has(a.agreementId));
    const anyDifferentState = selectedAgreements.some(a => {
      const siteStateCode = a.siteStateCode ?? undefined;
      return siteStateCode && businessStateCode && siteStateCode !== businessStateCode;
    });
    if (businessStateCode && selectedAgreements.length > 0) {
      setValue('taxMode', anyDifferentState ? 'inter' : 'intra');
    }
  }, [currentBusiness, selectedIds, activeAgreements, setValue]);

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
        (a.siteAddress && a.siteAddress.toLowerCase().includes(q)),
    );
  }, [activeAgreements, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.agreementId));

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
      taxMode: data.taxMode,
      sgstRate: data.taxMode === 'intra' ? sgstRate : undefined,
      cgstRate: data.taxMode === 'intra' ? cgstRate : undefined,
      igstRate: data.taxMode === 'inter' ? igstRate : undefined,
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
    <form onSubmit={onFormSubmit} className={styles.form}>
      <div className="form-content">
        {/* Shared billing params */}
        <div className="form-columns">
          <div>
            <div className="form-group">
              <label htmlFor="bulkBillDate">Bill Date *</label>
              <input id="bulkBillDate" type="date" {...register('billDate')} disabled={isLoading} />
              {errors.billDate && <span className="error-message">{errors.billDate.message}</span>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bulkPeriodStart">Period Start *</label>
                <input id="bulkPeriodStart" type="date" {...register('periodStart')} disabled={isLoading} />
                {errors.periodStart && <span className="error-message">{errors.periodStart.message}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="bulkPeriodEnd">Period End *</label>
                <input id="bulkPeriodEnd" type="date" {...register('periodEnd')} disabled={isLoading} />
                {errors.periodEnd && <span className="error-message">{errors.periodEnd.message}</span>}
              </div>
            </div>
          </div>
          <div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bulkTaxMode">Tax Mode</label>
                <select id="bulkTaxMode" {...register('taxMode')} disabled={isLoading}>
                  <option value="intra">Intra-state (SGST + CGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="bulkDiscountRate">Discount (%)</label>
                <input
                  id="bulkDiscountRate"
                  type="number"
                  step="0.01"
                  {...register('discountRate', { valueAsNumber: true })}
                  disabled={isLoading}
                />
              </div>
            </div>

            {taxMode === 'intra' ? (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bulkSgstRate">SGST (%)</label>
                  <input
                    id="bulkSgstRate"
                    type="number"
                    step="0.01"
                    {...register('sgstRate', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bulkCgstRate">CGST (%)</label>
                  <input
                    id="bulkCgstRate"
                    type="number"
                    step="0.01"
                    {...register('cgstRate', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bulkIgstRate">IGST (%)</label>
                  <input
                    id="bulkIgstRate"
                    type="number"
                    step="0.01"
                    {...register('igstRate', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agreement selection */}
        <div className={styles.agreementSection}>
          <div className={styles.agreementHeader}>
            <h3>Select Agreements ({selectedIds.size} selected)</h3>
          </div>

          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Search by party name, site, agreement ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
              disabled={isLoading}
            />
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                disabled={isLoading || filtered.length === 0}
              />
              Select all
            </label>
          </div>

          <div className={styles.agreementList}>
            {filtered.length === 0 && (
              <p className={styles.empty}>
                {search ? 'No agreements match your search.' : 'No active agreements found.'}
              </p>
            )}
            {filtered.map(a => (
              <label key={a.agreementId} className={styles.agreementRow}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.agreementId)}
                  onChange={() => toggle(a.agreementId)}
                  disabled={isLoading}
                />
                <div className={styles.agreementInfo}>
                  <span className={styles.agreementId}>{a.agreementId}</span>
                  <span className={styles.partyName}>{a.partyName}</span>
                  <span className={styles.siteInfo}>
                    {a.siteCode}
                    {a.siteAddress && ` — ${a.siteAddress}`}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || selectedIds.size === 0}
        >
          {isLoading
            ? 'Queuing...'
            : `Generate ${selectedIds.size} Bill${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );
}
