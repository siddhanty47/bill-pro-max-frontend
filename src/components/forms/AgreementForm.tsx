/**
 * Agreement form component
 *
 * Items are added via category checkboxes: selecting a category bulk-adds
 * every inventory item in that category with its default rate. Users can
 * then fine-tune individual rates in the preview table before submitting.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateAgreementInput, Inventory, Site, Agreement } from '../../types';
import styles from './AgreementForm.module.css';

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
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  /** Preserves user rate edits across category toggles (itemId -> rate) */
  const rateOverridesRef = useRef<Record<string, number>>({});

  /** Group inventory items by category */
  const categorizedItems = useMemo(() => {
    const map = new Map<string, Inventory[]>();
    for (const item of inventoryItems) {
      const existing = map.get(item.category) || [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return map;
  }, [inventoryItems]);

  const allCategories = useMemo(
    () => Array.from(categorizedItems.keys()).sort(),
    [categorizedItems]
  );

  /** Fast lookup from itemId to inventory details */
  const inventoryById = useMemo(() => {
    const map = new Map<string, Inventory>();
    for (const item of inventoryItems) {
      map.set(item._id, item);
    }
    return map;
  }, [inventoryItems]);

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
      rates: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: 'rates',
  });

  /** Build rates array from a set of selected categories, preserving user overrides */
  const buildRatesFromCategories = useCallback(
    (categories: Set<string>) => {
      const rates: Array<{ itemId: string; ratePerDay: number }> = [];
      for (const category of Array.from(categories).sort()) {
        const items = categorizedItems.get(category) || [];
        for (const item of items) {
          rates.push({
            itemId: item._id,
            ratePerDay: rateOverridesRef.current[item._id] ?? item.defaultRatePerDay ?? 0,
          });
        }
      }
      return rates;
    },
    [categorizedItems]
  );

  /** Toggle a single category on or off */
  const handleCategoryToggle = useCallback(
    (category: string) => {
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        replace(buildRatesFromCategories(next));
        return next;
      });
    },
    [buildRatesFromCategories, replace]
  );

  /** Select all or unselect all categories */
  const handleSelectAllToggle = useCallback(() => {
    const allSelected = selectedCategories.size === allCategories.length;
    if (allSelected) {
      setSelectedCategories(new Set());
      replace([]);
    } else {
      const all = new Set(allCategories);
      setSelectedCategories(all);
      replace(buildRatesFromCategories(all));
    }
  }, [selectedCategories.size, allCategories, buildRatesFromCategories, replace]);

  /** Track user rate edits so they survive category re-toggles */
  const handleRateChange = useCallback(
    (index: number, itemId: string, rate: number) => {
      rateOverridesRef.current[itemId] = rate;
      setValue(`rates.${index}.ratePerDay`, rate);
    },
    [setValue]
  );

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

  const isAllSelected = allCategories.length > 0 && selectedCategories.size === allCategories.length;
  const isSomeSelected = selectedCategories.size > 0 && !isAllSelected;

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
          <small className={styles.warningText}>
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

      {/* Category selection */}
      <div className="form-group">
        <label>Select Categories *</label>

        {allCategories.length === 0 && (
          <small className={styles.warningText}>No inventory items available.</small>
        )}

        {allCategories.length > 0 && (
          <div className={styles.categoryPanel}>
            {/* Select All / Unselect All */}
            <label className={styles.selectAllLabel}>
              <input
                className={styles.formCheckbox}
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={handleSelectAllToggle}
                disabled={isLoading}
              />
              {isAllSelected ? 'Unselect All' : 'Select All'}
            </label>

            {/* Individual categories */}
            {allCategories.map((category) => {
              const items = categorizedItems.get(category) || [];
              return (
                <label
                  key={category}
                  className={styles.categoryLabel}
                >
                  <input
                    type="checkbox"
                    className={styles.formCheckbox}
                    checked={selectedCategories.has(category)}
                    onChange={() => handleCategoryToggle(category)}
                    disabled={isLoading}
                  />
                  {category}
                  <span className={styles.categoryCount}>
                    ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {errors.rates && <span className="error-message">{errors.rates.message}</span>}
      </div>

      {/* Selected items preview with editable rates */}
      {fields.length > 0 && (
        <div className="form-group">
          <label>Selected Items ({fields.length})</label>
          <div className={styles.previewContainer}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th className={styles.rateColumn}>Rate/day (₹)</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const item = inventoryById.get(field.itemId);
                  return (
                    <tr key={field.id}>
                      <td className={styles.codeCell}>
                        {item?.code || '-'}
                      </td>
                      <td className={styles.cell}>{item?.name || '-'}</td>
                      <td className={styles.cell}>{item?.category || '-'}</td>
                      <td className={styles.cell}>
                        <input
                          type="number"
                          step="0.01"
                          {...register(`rates.${index}.ratePerDay`, { valueAsNumber: true })}
                          onChange={(e) =>
                            handleRateChange(index, field.itemId, parseFloat(e.target.value) || 0)
                          }
                          disabled={isLoading}
                          className={styles.rateInput}
                        />
                        <input type="hidden" {...register(`rates.${index}.itemId`)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
