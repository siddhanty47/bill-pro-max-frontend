/**
 * @fileoverview Inventory item detail view page
 * @description Detail page showing all information for a single inventory item,
 * fetched by ID from the URL parameter. Supports Jira-style inline editing for
 * category, unit, rate, and description fields. Total quantity is adjusted via
 * a transaction-based form (purchase / scraped / sold) with a history log.
 */
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetInventoryItemQuery,
  useUpdateInventoryMutation,
  useGetInventoryCategoriesQuery,
  useAdjustQuantityMutation,
} from '../api/inventoryApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { CodeAutocomplete, type AutocompleteItem } from '../components/CodeAutocomplete';
import type { AdjustQuantityInput, QuantityTransaction } from '../types';
import { getErrorMessage } from '../api/baseApi';

/** Unit options — must stay in sync with InventoryForm */
const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'meters', label: 'Meters' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'tons', label: 'Tons' },
  { value: 'sets', label: 'Sets' },
];

/** Transaction type options for the adjustment form */
const TRANSACTION_TYPE_OPTIONS: { value: AdjustQuantityInput['type']; label: string }[] = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'scraped', label: 'Scraped / Broken' },
  { value: 'sold', label: 'Sold' },
];

/** Returns today as YYYY-MM-DD for the date input max attribute */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Formats an ISO date string for display.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Badge class for transaction types.
 */
function transactionTypeBadge(type: QuantityTransaction['type']): string {
  switch (type) {
    case 'purchase':
      return 'status status-active';
    case 'scraped':
      return 'status status-cancelled';
    case 'sold':
      return 'status status-sent';
  }
}

/**
 * InventoryDetailPage displays the full details of a single inventory item.
 * Route: /inventory/:itemId
 */
export function InventoryDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const { data: item, isLoading, error, refetch } = useGetInventoryItemQuery(
    { businessId: currentBusinessId!, itemId: itemId! },
    { skip: !currentBusinessId || !itemId },
  );

  const [updateInventory, { isLoading: isSaving }] = useUpdateInventoryMutation();
  const [adjustQuantity, { isLoading: isAdjusting }] = useAdjustQuantityMutation();

  const { data: existingCategories } = useGetInventoryCategoriesQuery(
    currentBusinessId || '',
    { skip: !currentBusinessId },
  );

  /** Stock adjustment form state */
  const [adjType, setAdjType] = useState<AdjustQuantityInput['type']>('purchase');
  const [adjQuantity, setAdjQuantity] = useState('');
  const [adjDate, setAdjDate] = useState(getTodayISO);
  const [adjNote, setAdjNote] = useState('');
  const [adjError, setAdjError] = useState<string | null>(null);

  /** Map category strings to AutocompleteItem format for CodeAutocomplete */
  const categoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    if (!existingCategories) return [];
    return existingCategories.map((cat) => ({
      code: cat,
      label: cat,
      id: cat,
    }));
  }, [existingCategories]);

  /**
   * Generic save handler for simple (flat) inventory fields.
   */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateInventory({
        businessId: currentBusinessId!,
        itemId: itemId!,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, itemId, updateInventory],
  );

  /** Submit a stock adjustment transaction */
  const handleAdjustQuantity = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setAdjError(null);

      const qty = parseInt(adjQuantity, 10);
      if (!qty || qty < 1) {
        setAdjError('Quantity must be at least 1');
        return;
      }
      if (!adjDate) {
        setAdjError('Date is required');
        return;
      }

      try {
        await adjustQuantity({
          businessId: currentBusinessId!,
          itemId: itemId!,
          data: { type: adjType, quantity: qty, date: adjDate, note: adjNote || undefined },
        }).unwrap();

        setAdjQuantity('');
        setAdjNote('');
        setAdjDate(getTodayISO());
      } catch (err) {
        setAdjError(getErrorMessage(err));
      }
    },
    [adjType, adjQuantity, adjDate, adjNote, adjustQuantity, currentBusinessId, itemId],
  );

  /** Sorted history: newest first */
  const sortedHistory = useMemo(() => {
    if (!item?.quantityHistory?.length) return [];
    return [...item.quantityHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [item?.quantityHistory]);

  const sidebar = item ? (
    <DetailSection title="Details">
      <DetailField label="Code" value={item.code} />

      {/* Category — uses CodeAutocomplete in edit mode */}
      <DetailField
        label="Category"
        value={item.category}
        editable={{
          rawValue: item.category,
          inputType: 'text',
          onSave: (v) => handleSave('category', v),
          isSaving,
          renderEditInput: ({ value: editVal, onChange, onSave, onCancel }) => (
            <CodeAutocomplete
              label=""
              placeholder="Select or type a category..."
              value={String(editVal)}
              onChange={(val) => onChange(val)}
              items={categoryAutocompleteItems}
              onSelect={(selectedItem) => {
                onChange(selectedItem.label);
                setTimeout(onSave, 0);
              }}
            />
          ),
        }}
      />

      {/* Unit — select matching InventoryForm options */}
      <DetailField
        label="Unit"
        value={UNIT_OPTIONS.find((o) => o.value === item.unit)?.label ?? item.unit}
        editable={{
          rawValue: item.unit,
          inputType: 'select',
          options: UNIT_OPTIONS,
          onSave: (v) => handleSave('unit', v),
          isSaving,
        }}
      />

      {/* Default Rate/Day */}
      <DetailField
        label="Default Rate/Day"
        value={item.defaultRatePerDay != null ? `₹${item.defaultRatePerDay}` : undefined}
        editable={{
          rawValue: item.defaultRatePerDay,
          inputType: 'number',
          prefix: '₹',
          onSave: (v) => handleSave('defaultRatePerDay', v),
          isSaving,
        }}
      />

      <DetailField
        label="Status"
        value={
          <span className={`status status-${item.isActive ? 'active' : 'inactive'}`}>
            {item.isActive ? 'Active' : 'Inactive'}
          </span>
        }
      />
      <DetailField label="Created" value={formatDate(item.createdAt)} />
      <DetailField label="Updated" value={formatDate(item.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={item?.name || 'Inventory Item'}
      subtitle={item?.code ? `Code: ${item.code}` : undefined}
      status={item ? (item.isActive ? 'Active' : 'Inactive') : undefined}
      statusClassName={`status status-${item?.isActive ? 'active' : 'inactive'}`}
      backTo="/inventory"
      backLabel="Inventory"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {item && (
        <>
          {/* Stock Info */}
          <DetailSection title="Stock Information">
            <DetailField
              label="Total Quantity"
              value={`${item.totalQuantity} ${item.unit}`}
            />

            {/* Inline stock adjustment form — anchored to total quantity */}
            <div style={{ padding: '12px 0 4px' }}>
              <form onSubmit={handleAdjustQuantity} className="form-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as AdjustQuantityInput['type'])}
                  >
                    {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0, minWidth: '80px', maxWidth: '110px' }}>
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    value={adjQuantity}
                    onChange={(e) => setAdjQuantity(e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={adjDate}
                    max={getTodayISO()}
                    onChange={(e) => setAdjDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '120px' }}>
                  <label className="form-label">Note (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="e.g. batch #12"
                    maxLength={500}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-sm" disabled={isAdjusting} style={{ height: '36px' }}>
                  {isAdjusting ? 'Saving...' : 'Update Stock'}
                </button>
              </form>
              {adjError && <p style={{ color: '#dc3545', fontSize: '13px', marginTop: '6px' }}>{adjError}</p>}
            </div>

            <DetailField label="Available" value={`${item.availableQuantity} ${item.unit}`} />
            <DetailField label="Rented Out" value={`${item.rentedQuantity} ${item.unit}`} />
          </DetailSection>

          {/* Quantity History */}
          <DetailSection title="Quantity History">
            {sortedHistory.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>
                No quantity adjustments recorded.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((tx) => (
                      <tr key={tx._id}>
                        <td>{formatDate(tx.date)}</td>
                        <td>
                          <span className={transactionTypeBadge(tx.type)}>
                            {tx.type}
                          </span>
                        </td>
                        <td>
                          {tx.type === 'purchase' ? '+' : '-'}{tx.quantity}
                        </td>
                        <td>{tx.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DetailSection>

          {/* Purchase Info */}
          {item.purchaseInfo && (
            <DetailSection title="Purchase Information">
              <DetailField label="Supplier" value={item.purchaseInfo.supplierName} />
              <DetailField
                label="Cost Per Unit"
                value={`₹${item.purchaseInfo.costPerUnit}`}
              />
              <DetailField label="Purchase Date" value={formatDate(item.purchaseInfo.date)} />
              <DetailField
                label="Payment Status"
                value={
                  <span className={`status status-${item.purchaseInfo.paymentStatus}`}>
                    {item.purchaseInfo.paymentStatus}
                  </span>
                }
              />
            </DetailSection>
          )}

          {/* Description */}
          <DetailSection title="Description">
            <DetailField
              label=""
              value={item.description || undefined}
              emptyText="No description provided."
              editable={{
                rawValue: item.description ?? '',
                inputType: 'textarea',
                onSave: (v) => handleSave('description', v),
                isSaving,
              }}
            />
          </DetailSection>
        </>
      )}
    </DetailPageShell>
  );
}
