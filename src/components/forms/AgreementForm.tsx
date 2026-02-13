/**
 * Agreement form component
 */
import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateAgreementInput, Inventory, Site, Agreement } from '../../types';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';

const agreementSchema = z.object({
  siteCode: z.string().min(1, 'Select a site'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  billingCycle: z.enum(['monthly', 'weekly', 'yearly']),
  paymentDueDays: z.number().int().min(0).max(365),
  securityDeposit: z.number().min(0).optional(),
  rates: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Select an item'),
        ratePerDay: z.number().min(0, 'Rate must be positive'),
      })
    )
    .min(1, 'Add at least one item rate'),
});

type FormData = z.infer<typeof agreementSchema>;

interface AgreementFormProps {
  inventoryItems: Inventory[];
  /** Sites available for the party */
  sites: Site[];
  /** Existing agreements for the party (to filter out sites with active agreements) */
  existingAgreements: Agreement[];
  onSubmit: (data: CreateAgreementInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AgreementForm({
  inventoryItems,
  sites,
  existingAgreements,
  onSubmit,
  onCancel,
  isLoading,
}: AgreementFormProps) {
  // Track search values for each rate row's autocomplete
  const [rateSearchValues, setRateSearchValues] = useState<Record<number, string>>({});

  /**
   * Filter sites to only show those without active agreements
   */
  const availableSites = useMemo(() => {
    const activeSiteCodes = existingAgreements
      .filter((a) => a.status === 'active')
      .map((a) => a.siteCode);
    return sites.filter((site) => !activeSiteCodes.includes(site.code));
  }, [sites, existingAgreements]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      siteCode: '',
      startDate: new Date().toISOString().split('T')[0],
      billingCycle: 'monthly',
      paymentDueDays: 15,
      rates: [{ itemId: '', ratePerDay: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rates',
  });

  /**
   * Convert inventory items to autocomplete items
   */
  const inventoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return inventoryItems.map((item) => ({
      code: item.code || item.name.substring(0, 4).toUpperCase(),
      label: item.name,
      sublabel: item.category,
      id: item._id,
    }));
  }, [inventoryItems]);

  /**
   * Handle inventory selection for a rate row
   */
  const handleInventorySelect = useCallback(
    (index: number, item: AutocompleteItem) => {
      setValue(`rates.${index}.itemId`, item.id);
      // Also set the default rate if available
      const inventoryItem = inventoryItems.find((i) => i._id === item.id);
      if (inventoryItem?.defaultRatePerDay) {
        setValue(`rates.${index}.ratePerDay`, inventoryItem.defaultRatePerDay);
      }
      setRateSearchValues((prev) => ({ ...prev, [index]: item.code }));
    },
    [inventoryItems, setValue]
  );

  /**
   * Handle search value change for a rate row
   */
  const handleRateSearchChange = useCallback((index: number, value: string) => {
    setRateSearchValues((prev) => ({ ...prev, [index]: value }));
  }, []);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      siteCode: data.siteCode,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      terms: {
        billingCycle: data.billingCycle,
        paymentDueDays: data.paymentDueDays,
        securityDeposit: data.securityDeposit,
      },
      rates: data.rates,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="form-group">
        <label htmlFor="siteCode">Site *</label>
        <select id="siteCode" {...register('siteCode')} disabled={isLoading}>
          <option value="">Select a site</option>
          {availableSites.map((site) => (
            <option key={site.code} value={site.code}>
              {site.code} - {site.address.substring(0, 50)}{site.address.length > 50 ? '...' : ''}
            </option>
          ))}
        </select>
        {errors.siteCode && <span className="error-message">{errors.siteCode.message}</span>}
        {availableSites.length === 0 && (
          <small style={{ color: '#e74c3c' }}>
            No sites available. All sites have active agreements.
          </small>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startDate">Start Date *</label>
          <input id="startDate" type="date" {...register('startDate')} disabled={isLoading} />
          {errors.startDate && <span className="error-message">{errors.startDate.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input id="endDate" type="date" {...register('endDate')} disabled={isLoading} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="billingCycle">Billing Cycle *</label>
          <select id="billingCycle" {...register('billingCycle')} disabled={isLoading}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="paymentDueDays">Payment Due (days) *</label>
          <input
            id="paymentDueDays"
            type="number"
            {...register('paymentDueDays', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="securityDeposit">Security Deposit (₹)</label>
          <input
            id="securityDeposit"
            type="number"
            {...register('securityDeposit', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Item Rates *</label>
        {fields.map((field, index) => (
          <div key={field.id} className="form-row" style={{ marginBottom: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <CodeAutocomplete
                label=""
                placeholder="Type code or name..."
                value={rateSearchValues[index] || ''}
                onChange={(value) => handleRateSearchChange(index, value)}
                items={inventoryAutocompleteItems}
                onSelect={(item) => handleInventorySelect(index, item)}
                disabled={isLoading}
              />
              <input type="hidden" {...register(`rates.${index}.itemId`)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Rate/day (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Rate/day"
                {...register(`rates.${index}.ratePerDay`, { valueAsNumber: true })}
                disabled={isLoading}
              />
            </div>
            {fields.length > 1 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => remove(index)}
                disabled={isLoading}
                style={{ marginBottom: '5px' }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {errors.rates && <span className="error-message">{errors.rates.message}</span>}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => append({ itemId: '', ratePerDay: 0 })}
          disabled={isLoading}
        >
          + Add Item Rate
        </button>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Agreement'}
        </button>
      </div>
    </form>
  );
}
