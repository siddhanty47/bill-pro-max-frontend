/**
 * Challan form component
 */
import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Party, Inventory, CreateChallanInput } from '../../types';
import { CodeAutocomplete, type AutocompleteItem } from '../CodeAutocomplete';

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
  parties: Party[];
  inventoryItems: Inventory[];
  onSubmit: (data: CreateChallanInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ChallanForm({
  parties,
  inventoryItems,
  onSubmit,
  onCancel,
  isLoading,
}: ChallanFormProps) {
  // Track search values for party and item autocompletes
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
  const selectedParty = parties.find((p) => p._id === selectedPartyId);
  const activeAgreements = selectedParty?.agreements?.filter((a) => a.status === 'active') || [];
  const challanType = watch('type');

  /**
   * Convert parties to autocomplete items (only those with active agreements)
   */
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

  /**
   * Convert inventory items to autocomplete items
   */
  const inventoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return inventoryItems.map((item) => ({
      code: item.code || item.name.substring(0, 4).toUpperCase(),
      label: item.name,
      sublabel: `Avail: ${item.availableQuantity} ${item.unit}`,
      id: item._id,
    }));
  }, [inventoryItems]);

  /**
   * Handle party selection
   */
  const handlePartySelect = useCallback(
    (item: AutocompleteItem) => {
      setValue('partyId', item.id);
      setValue('agreementId', ''); // Reset agreement when party changes
      setPartySearchValue(item.code);
    },
    [setValue]
  );

  /**
   * Handle inventory item selection
   */
  const handleInventorySelect = useCallback(
    (index: number, item: AutocompleteItem) => {
      const inventoryItem = inventoryItems.find((i) => i._id === item.id);
      setValue(`items.${index}.itemId`, item.id);
      setValue(`items.${index}.itemName`, inventoryItem?.name || item.label);
      setItemSearchValues((prev) => ({ ...prev, [index]: item.code }));
    },
    [inventoryItems, setValue]
  );

  /**
   * Handle item search value change
   */
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
        <div className="form-group" style={{ flex: 1 }}>
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

        <div className="form-group" style={{ flex: 1 }}>
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

      <div className="form-group">
        <label>Items *</label>
        {fields.map((field, index) => (
          <div key={field.id} className="form-row" style={{ marginBottom: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
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
            <div className="form-group" style={{ flex: 1 }}>
              <label>Qty</label>
              <input
                type="number"
                placeholder="Qty"
                {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                disabled={isLoading}
              />
            </div>
            {challanType === 'return' && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>Condition</label>
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
