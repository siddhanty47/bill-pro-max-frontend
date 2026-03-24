/**
 * @fileoverview Inventory item detail view page
 * @description Detail page showing all information for a single inventory item,
 * fetched by ID from the URL parameter. Supports Jira-style inline editing for
 * category, unit, rate, and description fields. Total quantity is adjusted via
 * a transaction-based form (purchase / scraped / sold) with a history log.
 */
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import pageStyles from './InventoryDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetInventoryItemQuery,
  useUpdateInventoryMutation,
  useGetInventoryCategoriesQuery,
  useAdjustQuantityMutation,
  useGetOpeningBalancesQuery,
} from '../api/inventoryApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { Tabs } from '../components/Tabs';
import { CodeAutocomplete, type AutocompleteItem } from '../components/CodeAutocomplete';
import type { AdjustQuantityInput, QuantityTransaction } from '../types';
import { getErrorMessage } from '../api/baseApi';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';

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
    case 'damaged':
    case 'short':
      return 'status status-cancelled';
    case 'challan_loss_edit':
    case 'challan_item_edit':
      return 'status status-pending';
    case 'challan_delivery':
    case 'challan_return_reversed':
      return 'status status-sent';
    case 'challan_return':
    case 'challan_delivery_reversed':
      return 'status status-active';
    default:
      return 'status status-pending';
  }
}

/**
 * Display label for transaction types.
 */
function transactionTypeLabel(type: QuantityTransaction['type']): string {
  switch (type) {
    case 'challan_delivery':
      return 'Delivery (Reserved)';
    case 'challan_return':
      return 'Return';
    case 'challan_delivery_reversed':
      return 'Delivery Reversed';
    case 'challan_return_reversed':
      return 'Return Reversed';
    case 'challan_loss_edit':
      return 'Challan Loss Edit';
    case 'challan_item_edit':
      return 'Challan Item Edit';
    case 'damaged':
      return 'Damaged';
    case 'short':
      return 'Short';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Quantity display for transaction: + for add/return, - for reduce/reserve.
 * challan_delivery, challan_return_reversed: Rented + (items went to rented)
 * challan_return, challan_delivery_reversed: Returned + (items came back)
 */
function transactionQuantityDisplay(tx: QuantityTransaction): string {
  const prefix =
    tx.type === 'purchase' ||
    (tx.type === 'challan_loss_edit' && tx.note?.includes('reversed')) ||
    tx.type === 'challan_return' ||
    tx.type === 'challan_delivery_reversed'
      ? '+'
      : '-';
  const suffix =
    tx.type === 'challan_delivery' || tx.type === 'challan_return_reversed'
      ? ' (rented)'
      : tx.type === 'challan_return' || tx.type === 'challan_delivery_reversed'
        ? ' (returned)'
        : '';
  return `${prefix}${tx.quantity}${suffix}`;
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
  const { data: openingBalances } = useGetOpeningBalancesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const itemOpeningBalance = (itemId && openingBalances?.[itemId]) ?? 0;

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

  const [activeTab, setActiveTab] = useState('about');

  const TABS = [
    { id: 'about', label: 'About' },
    { id: 'history', label: 'History' },
  ];

  /** History: latest entry at top (reverse of insertion order) */
  const sortedHistory = useMemo(() => {
    if (!item?.quantityHistory?.length) return [];
    return [...item.quantityHistory].reverse();
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
          renderEditInput: ({ value: editVal, onChange, onSave }) => (
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

      {/* Damage Charge — fixed price per unit when returned damaged */}
      <DetailField
        label="Damage Charge (₹)"
        value={item.damageRate != null && item.damageRate > 0 ? `₹${item.damageRate}` : undefined}
        editable={{
          rawValue: item.damageRate ?? 0,
          inputType: 'number',
          prefix: '₹',
          onSave: (v) => handleSave('damageRate', v),
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
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'about' && (
            <>
              {/* Stock Info */}
              <DetailSection title="Stock Information">
                <DetailField
                  label="Total Quantity"
                  value={`${item.totalQuantity} ${item.unit}`}
                />

                {/* Inline stock adjustment form — anchored to total quantity */}
                <div className={pageStyles.adjustFormWrap}>
                  <form onSubmit={handleAdjustQuantity} className={`form-row ${pageStyles.adjustForm}`}>
                    <div className={`form-group ${pageStyles.adjustFormGroup}`}>
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

                    <div className={`form-group ${pageStyles.adjustFormGroup}`}>
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

                    <div className={`form-group ${pageStyles.adjustFormGroup}`}>
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

                    <div className={`form-group ${pageStyles.adjustFormGroupWide}`}>
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

                    <button type="submit" className={`btn btn-primary btn-sm ${pageStyles.adjustButton}`} disabled={isAdjusting}>
                      {isAdjusting ? 'Saving...' : 'Update Stock'}
                    </button>
                  </form>
                  {adjError && <p className="text-error-inline">{adjError}</p>}
                </div>

                <DetailField
                  label="Available"
                  value={`${computeAvailable(item.totalQuantity, computeRentedFromHistory(item.quantityHistory))} ${item.unit}`}
                />
                <DetailField
                  label="Rented Out"
                  value={`${computeRentedFromHistory(item.quantityHistory) + itemOpeningBalance} ${item.unit}`}
                />
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

          {activeTab === 'history' && (
            <DetailSection title="Quantity History">
              {sortedHistory.length === 0 ? (
                <p className="text-empty">
                  No quantity adjustments recorded.
                </p>
              ) : (
                <div className={pageStyles.historyTableWrap}>
                  <table className={`data-table ${pageStyles.historyTable}`}>
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
                              {transactionTypeLabel(tx.type)}
                            </span>
                          </td>
                          <td>
                            {transactionQuantityDisplay(tx)}
                          </td>
                          <td>{tx.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DetailSection>
          )}
        </>
      )}
    </DetailPageShell>
  );
}
