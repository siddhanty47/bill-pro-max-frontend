/**
 * Challan creation form with predicted challan number,
 * color-coded type support, and running-quantity display per item.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, Inventory, Challan, CreateChallanInput, Employee } from '../../types';
import { computeRentedFromHistory, computeAvailable } from '../../utils/inventoryUtils';
import { useGetNextChallanNumberQuery, useGetItemsWithPartyQuery } from '../../api/challanApi';
import { useGetEmployeesQuery } from '../../api/employeeApi';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';
import { DocumentNumberBadge } from '../DocumentNumberBadge';
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
  challanSequence: z.number().int().min(1).max(9999).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Select an item'),
        itemName: z.string().min(1),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'Add at least one item'),
  damagedItems: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Select an item'),
        itemName: z.string().min(1),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        damageRate: z.number().min(0),
        note: z.string().max(500).optional(),
        lossType: z.enum(['damage', 'short', 'need_repair']),
      })
    )
    .optional(),
  notes: z.string().max(1000).optional(),
  transporterId: z.string().optional(),
  transporterName: z.string().max(100).optional(),
  vehicleNumber: z.string().max(20).optional(),
  cartageCharge: z.number().min(0).optional(),
  loadingCharge: z.number().min(0).optional(),
  unloadingCharge: z.number().min(0).optional(),
});

type FormData = z.infer<typeof challanSchema>;

interface ChallanFormProps {
  businessId: string;
  /** Challan type — determined by which button opened the form. */
  type: 'delivery' | 'return';
  parties: Party[];
  inventoryItems: Inventory[];
  /** Existing challans used as fallback for client-side number prediction. */
  challans: Challan[];
  onSubmit: (data: CreateChallanInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form for creating delivery or return challans.
 * Displays a predicted challan number and per-item running quantities
 * for the selected party + agreement combination.
 */
export function ChallanForm({
  businessId,
  type: challanType,
  parties,
  inventoryItems,
  challans,
  onSubmit,
  onCancel,
  isLoading,
}: ChallanFormProps) {
  const [partySearchValue, setPartySearchValue] = useState('');
  const [itemSearchValues, setItemSearchValues] = useState<Record<number, string>>({});
  const [damagedItemSearchValues, setDamagedItemSearchValues] = useState<Record<number, string>>({});

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
      type: challanType,
      date: new Date().toISOString().split('T')[0],
      items: [{ itemId: '', itemName: '', quantity: 1 }],
      damagedItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const {
    fields: damagedFields,
    append: appendDamaged,
    remove: removeDamaged,
  } = useFieldArray({
    control,
    name: 'damagedItems',
  });

  const selectedPartyId = watch('partyId');
  const selectedAgreementId = watch('agreementId');
  const selectedParty = parties.find((p) => p._id === selectedPartyId);
  const activeAgreements = selectedParty?.agreements?.filter((a) => a.status === 'active') || [];
  const challanDate = watch('date');

  /** Fetch transporter employees for the business */
  const { data: employeesResponse } = useGetEmployeesQuery(
    { businessId, type: 'transporter' },
    { skip: !businessId }
  );
  const transporters: Employee[] = employeesResponse?.data ?? [];

  /** Auto-fill cartage charges when agreement or challan type changes */
  const selectedAgreement = selectedParty?.agreements?.find(
    (a) => a.agreementId === selectedAgreementId
  );

  useEffect(() => {
    if (!selectedAgreement) return;
    const terms = selectedAgreement.terms;
    const cartage = challanType === 'delivery' ? terms.deliveryCartage : terms.returnCartage;
    if (cartage != null) setValue('cartageCharge', cartage);
    if (terms.loadingCharge != null) setValue('loadingCharge', terms.loadingCharge);
    if (terms.unloadingCharge != null) setValue('unloadingCharge', terms.unloadingCharge);
  }, [selectedAgreementId, challanType, selectedAgreement, setValue]);

  /** Handle transporter selection — auto-fill name and vehicle */
  const handleTransporterChange = useCallback(
    (transporterId: string) => {
      setValue('transporterId', transporterId);
      const transporter = transporters.find((t) => t._id === transporterId);
      if (transporter) {
        setValue('transporterName', transporter.name);
        setValue('vehicleNumber', transporter.details?.vehicleNumber ?? '');
      } else {
        setValue('transporterName', '');
        setValue('vehicleNumber', '');
      }
    },
    [transporters, setValue]
  );

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

  /** Parse predicted number into prefix and default sequence */
  const challanPrefix = useMemo(() => {
    if (!predictedNumber) return '';
    const parts = predictedNumber.split('-');
    // Remove the last segment (sequence) to get the prefix
    return parts.slice(0, -1).join('-') + '-';
  }, [predictedNumber]);

  const defaultSequence = useMemo(() => {
    if (!predictedNumber) return undefined;
    const parts = predictedNumber.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    return isNaN(seq) ? undefined : seq;
  }, [predictedNumber]);

  /** Set the default challan sequence when predicted number loads */
  useEffect(() => {
    if (defaultSequence != null) {
      setValue('challanSequence', defaultSequence);
    }
  }, [defaultSequence, setValue]);

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
    return inventoryItems.map((item) => {
      const rented = computeRentedFromHistory(item.quantityHistory);
      const avail = computeAvailable(item.totalQuantity, rented);
      return {
        code: item.code || item.name.substring(0, 4).toUpperCase(),
        label: item.name,
        sublabel: `Avail: ${avail} ${item.unit}`,
        id: item._id,
      };
    });
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

  const handleDamagedItemSelect = useCallback(
    (index: number, item: AutocompleteItem) => {
      const inventoryItem = inventoryItems.find((i) => i._id === item.id);
      setValue(`damagedItems.${index}.itemId`, item.id);
      setValue(`damagedItems.${index}.itemName`, inventoryItem?.name || item.label);
      setValue(`damagedItems.${index}.damageRate`, inventoryItem?.damageRate ?? 0);
      setValue(`damagedItems.${index}.lossType`, 'damage');
      setDamagedItemSearchValues((prev) => ({ ...prev, [index]: item.code }));
    },
    [inventoryItems, setValue]
  );

  const handleDamagedItemSearchChange = useCallback((index: number, value: string) => {
    setDamagedItemSearchValues((prev) => ({ ...prev, [index]: value }));
  }, []);

  const handleFormSubmit = async (data: FormData) => {
    const damagedItems =
      data.type === 'return' && data.damagedItems?.length
        ? data.damagedItems
            .filter((d) => d.itemId)
            .map((d) => ({
              itemId: d.itemId,
              itemName: d.itemName,
              quantity: d.quantity,
              damageRate: d.damageRate,
              note: d.note || undefined,
              lossType: d.lossType || 'damage',
            }))
        : undefined;

    await onSubmit({
      type: data.type,
      partyId: data.partyId,
      agreementId: data.agreementId,
      date: data.date,
      challanSequence: data.challanSequence,
      items: data.items.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
      })),
      damagedItems: damagedItems?.length ? damagedItems : undefined,
      notes: data.notes || undefined,
      transporterName: data.transporterName || undefined,
      vehicleNumber: data.vehicleNumber || undefined,
      cartageCharge: data.cartageCharge,
      loadingCharge: data.loadingCharge,
      unloadingCharge: data.unloadingCharge,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormSubmit = handleSubmit(handleFormSubmit as any);

  return (
    <form onSubmit={onFormSubmit}>
      <div className="form-content">
      {/* Challan number: prefix (read-only) + editable sequence */}
      <DocumentNumberBadge
        label="Challan #"
        prefix={challanPrefix}
        isLoading={isPredictedLoading}
        disabled={isLoading || isPredictedLoading}
        variant={challanType}
        register={register('challanSequence', { valueAsNumber: true })}
        error={errors.challanSequence?.message}
      />

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input id="date" type="date" {...register('date')} disabled={isLoading} />
          {errors.date && <span className="error-message">{errors.date.message}</span>}
        </div>
      </div>
      <input type="hidden" {...register('type')} />

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

      {/* Items section — table/spreadsheet style */}
      <div className="form-group">
        <label>Items *</label>
        <div className={styles.itemsTableWrap}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th className={styles.colItem}>Item</th>
                <th className={styles.colQty}>Qty</th>
                <th className={styles.colRunning}>Running</th>
                <th className={styles.colAction}></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const currentItemId = watch(`items.${index}.itemId`);
                const runningQty = getRunningQty(currentItemId);

                return (
                  <tr key={field.id}>
                    <td className={styles.colItem}>
                      <div className={styles.tableCellAutocomplete}>
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
                    </td>
                    <td className={styles.colQty}>
                      <input
                        type="number"
                        placeholder="Qty"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                    </td>
                    <td className={styles.colRunning}>
                      <span className="badge-neutral">
                        {runningQty}
                      </span>
                    </td>
                    <td className={styles.colAction}>
                      <button
                        type="button"
                        className={styles.deleteIconBtn}
                        onClick={() => remove(index)}
                        disabled={isLoading || fields.length <= 1}
                        title="Delete row"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.items && <span className="error-message">{errors.items.message}</span>}
        <button
          type="button"
          className={`btn btn-secondary btn-sm ${styles.addRowBtn}`}
          onClick={() => append({ itemId: '', itemName: '', quantity: 1 })}
          disabled={isLoading}
        >
          + Add Item
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" {...register('notes')} rows={2} disabled={isLoading} />
      </div>

      {/* Loss section (return challans only) — table style */}
      {challanType === 'return' && (
        <fieldset className="form-fieldset">
          <legend className="form-fieldset-legend">
            Loss
          </legend>

          <div className={styles.lossTableWrap}>
            <table className={styles.lossTable}>
              <thead>
                <tr>
                  <th className={styles.colItem}>Item</th>
                  <th className={styles.colType}>Type</th>
                  <th className={styles.colQty}>Qty</th>
                  <th className={styles.colRate}>Rate</th>
                  <th className={styles.colNote}>Note</th>
                  <th className={styles.colAction}></th>
                </tr>
              </thead>
              <tbody>
                {damagedFields.map((field, index) => (
                  <tr key={field.id}>
                    <td className={styles.colItem}>
                      <div className={styles.tableCellAutocomplete}>
                        <CodeAutocomplete
                          label=""
                          placeholder="Type item code or name..."
                          value={damagedItemSearchValues[index] || ''}
                          onChange={(value) => handleDamagedItemSearchChange(index, value)}
                          items={inventoryAutocompleteItems}
                          onSelect={(item) => handleDamagedItemSelect(index, item)}
                          disabled={isLoading}
                        />
                        <input type="hidden" {...register(`damagedItems.${index}.itemId`)} />
                        <input type="hidden" {...register(`damagedItems.${index}.itemName`)} />
                      </div>
                    </td>
                    <td className={styles.colType}>
                      <select
                        {...register(`damagedItems.${index}.lossType`)}
                        disabled={isLoading}
                        title="Damage = received damaged; Short = missing/less; Need Repair = can be fixed"
                      >
                        <option value="damage">Damaged</option>
                        <option value="short">Short</option>
                        <option value="need_repair">Need Repair</option>
                      </select>
                    </td>
                    <td className={styles.colQty}>
                      <input
                        type="number"
                        placeholder="Qty"
                        {...register(`damagedItems.${index}.quantity`, { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                    </td>
                    <td className={styles.colRate}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        {...register(`damagedItems.${index}.damageRate`, { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                    </td>
                    <td className={styles.colNote}>
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        {...register(`damagedItems.${index}.note`)}
                        disabled={isLoading}
                      />
                    </td>
                    <td className={styles.colAction}>
                      <button
                        type="button"
                        className={styles.deleteIconBtn}
                        onClick={() => removeDamaged(index)}
                        disabled={isLoading}
                        title="Delete row"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className={`btn btn-secondary btn-sm ${styles.addLossRowBtn}`}
            onClick={() => appendDamaged({ itemId: '', itemName: '', quantity: 1, damageRate: 0, note: '', lossType: 'damage' })}
            disabled={isLoading}
          >
            + Add Loss Item
          </button>
        </fieldset>
      )}

      {/* Transportation section */}
      <fieldset className="form-fieldset">
        <legend className="form-fieldset-legend">
          Transportation
        </legend>

        <div className="form-row">
          <div className={`form-group ${styles.flexGrow2}`}>
            <label htmlFor="transporterId">Transporter</label>
            <select
              id="transporterId"
              {...register('transporterId')}
              onChange={(e) => handleTransporterChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select transporter...</option>
              {transporters.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.details?.vehicleNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="transporterName">Transporter Name</label>
            <input
              id="transporterName"
              type="text"
              {...register('transporterName')}
              disabled={isLoading}
              placeholder="Auto-filled from selection"
            />
          </div>
          <div className="form-group">
            <label htmlFor="vehicleNumber">Vehicle Number</label>
            <input
              id="vehicleNumber"
              type="text"
              {...register('vehicleNumber')}
              disabled={isLoading}
              placeholder="Auto-filled from selection"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cartageCharge">Cartage (₹)</label>
            <input
              id="cartageCharge"
              type="number"
              step="0.01"
              {...register('cartageCharge', { valueAsNumber: true })}
              disabled={isLoading}
              placeholder="Auto-filled from agreement"
            />
          </div>
          <div className="form-group">
            <label htmlFor="loadingCharge">Loading (₹)</label>
            <input
              id="loadingCharge"
              type="number"
              step="0.01"
              {...register('loadingCharge', { valueAsNumber: true })}
              disabled={isLoading}
              placeholder="Auto-filled from agreement"
            />
          </div>
          <div className="form-group">
            <label htmlFor="unloadingCharge">Unloading (₹)</label>
            <input
              id="unloadingCharge"
              type="number"
              step="0.01"
              {...register('unloadingCharge', { valueAsNumber: true })}
              disabled={isLoading}
              placeholder="Auto-filled from agreement"
            />
          </div>
        </div>
      </fieldset>
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
