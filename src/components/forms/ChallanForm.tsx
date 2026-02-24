/**
 * Challan creation form with predicted challan number,
 * color-coded type support, and running-quantity display per item.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, Inventory, Challan, CreateChallanInput } from '../../types';
import { useGetNextChallanNumberQuery, useGetItemsWithPartyQuery } from '../../api/challanApi';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';
import styles from './ChallanForm.module.css';

/**
 * Compute the Indian financial year string (e.g. "2025-26") from a date.
 * FY runs April–March; Jan–Mar belongs to the previous FY.
 */
function getFinancialYear(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStartYear = month < 3 ? year - 1 : year;
  const fyEndYear = fyStartYear + 1;
  return `${fyStartYear}-${String(fyEndYear).slice(-2)}`;
}

/**
 * Client-side prediction of the next challan number using the already-loaded
 * challans list. Mirrors the backend logic: count challans whose number starts
 * with the matching prefix + FY, then increment.
 */
function predictChallanNumberLocally(
  challans: Challan[],
  type: 'delivery' | 'return',
  dateStr: string
): string {
  const prefix = type === 'delivery' ? 'D' : 'R';
  const fy = getFinancialYear(dateStr ? new Date(dateStr) : new Date());
  const pattern = `${prefix}-${fy}-`;
  const count = challans.filter((c) => c.challanNumber.startsWith(pattern)).length;
  return `${prefix}-${fy}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Compute net item quantities currently with a party for a given agreement
 * from the client-side challans list. Mirrors the backend aggregation:
 * sum confirmed delivery quantities minus confirmed return quantities per item.
 */
function computeItemsWithPartyLocally(
  challans: Challan[],
  partyId: string,
  agreementId: string
): Map<string, number> {
  const qtyMap = new Map<string, number>();

  const relevant = challans.filter(
    (c) =>
      c.partyId === partyId &&
      c.agreementId === agreementId &&
      c.status === 'confirmed'
  );

  for (const challan of relevant) {
    for (const item of challan.items) {
      const current = qtyMap.get(item.itemId) ?? 0;
      const delta = challan.type === 'delivery' ? item.quantity : -item.quantity;
      qtyMap.set(item.itemId, current + delta);
    }
  }

  return qtyMap;
}

const challanSchema = z.object({
  type: z.enum(['delivery', 'return']),
  partyId: z.string().min(1, 'Select a party'),
  agreementId: z.string().min(1, 'Select an agreement'),
  date: z.string().min(1, 'Date is required'),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Select an item'),
        itemName: z.string().min(1),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        condition: z.enum(['good', 'damaged', 'missing']),
      })
    )
    .min(1, 'Add at least one item'),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof challanSchema>;

interface ChallanFormProps {
  businessId: string;
  parties: Party[];
  inventoryItems: Inventory[];
  /** Existing challans used as fallback for client-side number prediction. */
  challans: Challan[];
  onSubmit: (data: CreateChallanInput) => Promise<void>;
  onCancel: () => void;
  onTypeChange?: (type: 'delivery' | 'return') => void;
  isLoading?: boolean;
}

/**
 * Form for creating delivery or return challans.
 * Displays a predicted challan number and per-item running quantities
 * for the selected party + agreement combination.
 */
export function ChallanForm({
  businessId,
  parties,
  inventoryItems,
  challans,
  onSubmit,
  onCancel,
  onTypeChange,
  isLoading,
}: ChallanFormProps) {
  const [partySearchValue, setPartySearchValue] = useState('');
  const [itemSearchValues, setItemSearchValues] = useState<Record<number, string>>({});

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      type: 'delivery',
      date: new Date().toISOString().split('T')[0],
      items: [{ itemId: '', itemName: '', quantity: 1, condition: 'good' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const selectedPartyId = watch('partyId');
  const selectedAgreementId = watch('agreementId');
  const selectedParty = parties.find((p) => p._id === selectedPartyId);
  const activeAgreements = selectedParty?.agreements?.filter((a) => a.status === 'active') || [];
  const challanType = watch('type');
  const challanDate = watch('date');

  /** Notify parent whenever the challan type changes so the modal variant can update. */
  useEffect(() => {
    onTypeChange?.(challanType);
  }, [challanType, onTypeChange]);

  /** Fetch predicted next challan number; fall back to client-side estimation. */
  const {
    data: apiPredictedNumber,
    isFetching: isPredictedLoading,
    isError: isPredictedError,
  } = useGetNextChallanNumberQuery(
    { businessId, type: challanType, date: challanDate },
    { skip: !businessId || !challanDate }
  );

  const predictedNumber = useMemo(() => {
    if (apiPredictedNumber) return apiPredictedNumber;
    if (isPredictedError || !isPredictedLoading) {
      return predictChallanNumberLocally(challans, challanType, challanDate);
    }
    return undefined;
  }, [apiPredictedNumber, isPredictedError, isPredictedLoading, challans, challanType, challanDate]);

  /**
   * Fetch items currently with the selected party for the chosen agreement.
   * Falls back to client-side computation from the loaded challans list
   * when the API endpoint is unavailable.
   */
  const {
    data: apiItemsWithParty,
    isError: isItemsWithPartyError,
  } = useGetItemsWithPartyQuery(
    { businessId, partyId: selectedPartyId, agreementId: selectedAgreementId },
    { skip: !businessId || !selectedPartyId || !selectedAgreementId }
  );

  const localItemsMap = useMemo(() => {
    if (!selectedPartyId || !selectedAgreementId) return new Map<string, number>();
    return computeItemsWithPartyLocally(challans, selectedPartyId, selectedAgreementId);
  }, [challans, selectedPartyId, selectedAgreementId]);

  /** Look up the running quantity for a given itemId, preferring API data. */
  const getRunningQty = useCallback(
    (itemId: string): number => {
      if (!itemId) return 0;
      if (apiItemsWithParty && !isItemsWithPartyError) {
        return apiItemsWithParty.find((i) => i.itemId === itemId)?.quantity ?? 0;
      }
      return localItemsMap.get(itemId) ?? 0;
    },
    [apiItemsWithParty, isItemsWithPartyError, localItemsMap]
  );

  const partyAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return parties
      .filter((p) => p.agreements && p.agreements.some((a) => a.status === 'active'))
      .map((party) => ({
        code: party.code || party.name.substring(0, 4).toUpperCase(),
        label: party.name,
        sublabel: party.contact.person,
        id: party._id,
      }));
  }, [parties]);

  const inventoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return inventoryItems.map((item) => ({
      code: item.code || item.name.substring(0, 4).toUpperCase(),
      label: item.name,
      sublabel: `Avail: ${item.availableQuantity} ${item.unit}`,
      id: item._id,
    }));
  }, [inventoryItems]);

  const handlePartySelect = useCallback(
    (item: AutocompleteItem) => {
      setValue('partyId', item.id);
      setValue('agreementId', '');
      setPartySearchValue(item.code);
    },
    [setValue]
  );

  const handleInventorySelect = useCallback(
    (index: number, item: AutocompleteItem) => {
      const inventoryItem = inventoryItems.find((i) => i._id === item.id);
      setValue(`items.${index}.itemId`, item.id);
      setValue(`items.${index}.itemName`, inventoryItem?.name || item.label);
      setItemSearchValues((prev) => ({ ...prev, [index]: item.code }));
    },
    [inventoryItems, setValue]
  );

  const handleItemSearchChange = useCallback((index: number, value: string) => {
    setItemSearchValues((prev) => ({ ...prev, [index]: value }));
  }, []);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      type: data.type,
      partyId: data.partyId,
      agreementId: data.agreementId,
      date: data.date,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        condition: item.condition,
      })),
      notes: data.notes || undefined,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      {/* Predicted challan number badge */}
      <div className={styles.challanNumberBadge}>
        <span className={styles.challanNumberLabel}>Challan #</span>
        <span className={`${styles.challanNumberValue} ${styles[challanType]}`}>
          {isPredictedLoading ? '...' : predictedNumber ?? '—'}
        </span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="type">Challan Type *</label>
          <select id="type" {...register('type')} disabled={isLoading}>
            <option value="delivery">Delivery</option>
            <option value="return">Return</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input id="date" type="date" {...register('date')} disabled={isLoading} />
          {errors.date && <span className="error-message">{errors.date.message}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className={`form-group ${styles.flexGroup}`}>
          <CodeAutocomplete
            label="Party *"
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

        <div className={`form-group ${styles.flexGroup}`}>
          <label htmlFor="agreementId">Agreement *</label>
          <select id="agreementId" {...register('agreementId')} disabled={isLoading || !selectedPartyId}>
            <option value="">Select agreement...</option>
            {activeAgreements.map((agreement) => (
              <option key={agreement.agreementId} value={agreement.agreementId}>
                {agreement.agreementId} (from {new Date(agreement.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>
          {errors.agreementId && <span className="error-message">{errors.agreementId.message}</span>}
        </div>
      </div>

      {/* Items section with column headers */}
      <div className="form-group">
        <label>Items *</label>
        <div className={styles.itemHeader}>
          <span className={styles.itemHeaderName}>Item</span>
          <span className={styles.itemHeaderQty}>Qty</span>
          <span className={styles.itemHeaderRunning}>Running</span>
          {challanType === 'return' && <span className={styles.itemHeaderCondition}>Condition</span>}
          <span className={styles.itemHeaderAction}></span>
        </div>

        {fields.map((field, index) => {
          const currentItemId = watch(`items.${index}.itemId`);
          const runningQty = getRunningQty(currentItemId);

          return (
            <div key={field.id} className={`form-row ${styles.itemRow}`}>
              <div className={styles.itemAutocomplete}>
                <CodeAutocomplete
                  label=""
                  placeholder="Type item code or name..."
                  value={itemSearchValues[index] || ''}
                  onChange={(value) => handleItemSearchChange(index, value)}
                  items={inventoryAutocompleteItems}
                  onSelect={(item) => handleInventorySelect(index, item)}
                  disabled={isLoading}
                />
                <input type="hidden" {...register(`items.${index}.itemId`)} />
                <input type="hidden" {...register(`items.${index}.itemName`)} />
              </div>

              <div className={`form-group ${styles.qtyGroup}`}>
                <input
                  type="number"
                  placeholder="Qty"
                  {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  disabled={isLoading}
                />
              </div>

              <div className={styles.runningQty}>
                <span className={styles.runningQtyValue}>{runningQty}</span>
              </div>

              {challanType === 'return' && (
                <div className={`form-group ${styles.conditionGroup}`}>
                  <select {...register(`items.${index}.condition`)} disabled={isLoading}>
                    <option value="good">Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                </div>
              )}

              {fields.length > 1 && (
                <button
                  type="button"
                  className={`btn btn-danger btn-sm ${styles.removeButton}`}
                  onClick={() => remove(index)}
                  disabled={isLoading}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
        {errors.items && <span className="error-message">{errors.items.message}</span>}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => append({ itemId: '', itemName: '', quantity: 1, condition: 'good' })}
          disabled={isLoading}
        >
          + Add Item
        </button>
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
          {isLoading ? 'Creating...' : 'Create Challan'}
        </button>
      </div>
    </form>
  );
}
