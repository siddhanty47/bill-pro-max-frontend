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
import {
  Button,
  Checkbox,
  Field,
  Fieldset,
  Input,
  Select,
  Table,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from '../ui';
import styles from './AgreementForm.module.css';

const agreementSchema = z.object({
  siteCode: z.string().min(1, 'Select a site'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  billingCycle: z.enum(['monthly', 'weekly', 'yearly']),
  paymentDueDays: z.number().int().min(0).max(365),
  securityDeposit: z.number().min(0).optional(),
  deliveryCartage: z.number().min(0).optional(),
  returnCartage: z.number().min(0).optional(),
  loadingCharge: z.number().min(0).optional(),
  unloadingCharge: z.number().min(0).optional(),
  rates: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Select an item'),
        ratePerDay: z.number().min(0, 'Rate must be positive'),
        openingBalance: z.number().min(0, 'Opening balance must be non-negative'),
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
  /** Preserves user opening balance edits across category toggles (itemId -> qty) */
  const openingBalanceOverridesRef = useRef<Record<string, number>>({});

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
      .filter(a => a.status === 'active')
      .map(a => a.siteCode);
    return sites.filter(site => !activeSiteCodes.includes(site.code));
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
      securityDeposit: 0,
      deliveryCartage: 0,
      returnCartage: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
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
      const rates: Array<{ itemId: string; ratePerDay: number; openingBalance: number }> = [];
      for (const category of Array.from(categories).sort()) {
        const items = categorizedItems.get(category) || [];
        for (const item of items) {
          rates.push({
            itemId: item._id,
            ratePerDay: rateOverridesRef.current[item._id] ?? item.defaultRatePerDay ?? 0,
            openingBalance: openingBalanceOverridesRef.current[item._id] ?? 0,
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
      setSelectedCategories(prev => {
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

  /** Track user opening balance edits so they survive category re-toggles */
  const handleOpeningBalanceChange = useCallback(
    (index: number, itemId: string, qty: number) => {
      openingBalanceOverridesRef.current[itemId] = qty;
      setValue(`rates.${index}.openingBalance`, qty);
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
        deliveryCartage: data.deliveryCartage,
        returnCartage: data.returnCartage,
        loadingCharge: data.loadingCharge,
        unloadingCharge: data.unloadingCharge,
      },
      rates: data.rates,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  const isAllSelected =
    allCategories.length > 0 && selectedCategories.size === allCategories.length;
  const isSomeSelected = selectedCategories.size > 0 && !isAllSelected;

  return (
    <form onSubmit={onFormSubmit} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Field
            label="Site"
            required
            error={errors.siteCode?.message}
            hint={
              availableSites.length === 0
                ? 'No sites available. All sites have active agreements.'
                : undefined
            }
          >
            <Select {...register('siteCode')} disabled={isLoading}>
              <option value="">Select a site</option>
              {availableSites.map(site => (
                <option key={site.code} value={site.code}>
                  {site.code} - {site.address.substring(0, 50)}
                  {site.address.length > 50 ? '...' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <div className={styles.pair}>
            <Field label="Start date" required error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} disabled={isLoading} />
            </Field>
            <Field label="End date">
              <Input type="date" {...register('endDate')} disabled={isLoading} />
            </Field>
          </div>

          <div className={styles.pair}>
            <Field label="Billing cycle" required>
              <Select {...register('billingCycle')} disabled={isLoading}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </Field>
            <Field label="Payment due (days)" required>
              <Input
                mono
                type="number"
                {...register('paymentDueDays', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
          </div>

          <div className={styles.pair}>
            <Field label="Security deposit (₹)">
              <Input
                mono
                type="number"
                {...register('securityDeposit', { valueAsNumber: true })}
                disabled={isLoading}
              />
            </Field>
          </div>
        </div>

        <div className={styles.column}>
          <Fieldset legend="Transportation charges (optional)">
            <div className={styles.fieldsetBody}>
              <div className={styles.pair}>
                <Field label="Delivery cartage (₹)">
                  <Input
                    mono
                    type="number"
                    step="0.01"
                    {...register('deliveryCartage', { valueAsNumber: true })}
                    disabled={isLoading}
                    placeholder="0"
                  />
                </Field>
                <Field label="Return cartage (₹)">
                  <Input
                    mono
                    type="number"
                    step="0.01"
                    {...register('returnCartage', { valueAsNumber: true })}
                    disabled={isLoading}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className={styles.pair}>
                <Field label="Loading charge (₹)">
                  <Input
                    mono
                    type="number"
                    step="0.01"
                    {...register('loadingCharge', { valueAsNumber: true })}
                    disabled={isLoading}
                    placeholder="0"
                  />
                </Field>
                <Field label="Unloading charge (₹)">
                  <Input
                    mono
                    type="number"
                    step="0.01"
                    {...register('unloadingCharge', { valueAsNumber: true })}
                    disabled={isLoading}
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>
          </Fieldset>
        </div>
      </div>

      <div className={styles.section}>
        <Field
          label="Categories"
          required
          role="group"
          aria-label="Categories"
          error={errors.rates?.message}
          hint={allCategories.length === 0 ? 'No inventory items available.' : undefined}
        >
          {allCategories.length > 0 && (
            <div className={styles.categoryPanel}>
              <Checkbox
                label={isAllSelected ? 'Unselect all' : 'Select all'}
                checked={isAllSelected}
                ref={el => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={handleSelectAllToggle}
                disabled={isLoading}
              />
              {allCategories.map(category => {
                const items = categorizedItems.get(category) || [];
                return (
                  <Checkbox
                    key={category}
                    label={`${category} (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
                    checked={selectedCategories.has(category)}
                    onChange={() => handleCategoryToggle(category)}
                    disabled={isLoading}
                  />
                );
              })}
            </div>
          )}
        </Field>
      </div>

      {fields.length > 0 && (
        <div className={styles.section}>
          <span className={styles.gridTitle}>Selected items ({fields.length})</span>
          <div className={styles.gridScroll}>
            <Table aria-label="Selected items">
              <THead>
                <Tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th hideOnMobile>Category</Th>
                  <Th align="right">Rate/day (₹)</Th>
                  <Th align="right">Opening balance</Th>
                </Tr>
              </THead>
              <TBody>
                {fields.map((field, index) => {
                  const item = inventoryById.get(field.itemId);
                  return (
                    <Tr key={field.id}>
                      <Td mono nowrap>
                        {item?.code || '-'}
                      </Td>
                      <Td>{item?.name || '-'}</Td>
                      <Td hideOnMobile>{item?.category || '-'}</Td>
                      <Td align="right">
                        <Input
                          mono
                          type="number"
                          step="0.01"
                          aria-label={`Rate per day for ${item?.name ?? 'item'}`}
                          {...register(`rates.${index}.ratePerDay`, { valueAsNumber: true })}
                          onChange={e =>
                            handleRateChange(index, field.itemId, parseFloat(e.target.value) || 0)
                          }
                          disabled={isLoading}
                          className={styles.rateInput}
                        />
                        <input type="hidden" {...register(`rates.${index}.itemId`)} />
                      </Td>
                      <Td align="right">
                        <Input
                          mono
                          type="number"
                          step="1"
                          min="0"
                          aria-label={`Opening balance for ${item?.name ?? 'item'}`}
                          {...register(`rates.${index}.openingBalance`, { valueAsNumber: true })}
                          onChange={e =>
                            handleOpeningBalanceChange(
                              index,
                              field.itemId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={isLoading}
                          className={styles.rateInput}
                          placeholder="0"
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          Create agreement
        </Button>
      </div>
    </form>
  );
}
