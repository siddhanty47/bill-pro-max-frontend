/**
 * @fileoverview Inventory item detail view page
 * @description Detail page showing all information for a single inventory item,
 * fetched by ID from the URL parameter. Supports Jira-style inline editing for
 * category, unit, rate, and description fields. Total quantity is adjusted via
 * a transaction-based form (purchase / scraped / sold) with a history log.
 */
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import styles from './InventoryDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetInventoryItemQuery,
  useUpdateInventoryMutation,
  useGetInventoryCategoriesQuery,
  useAdjustQuantityMutation,
  useGetOpeningBalancesQuery,
} from '../api/inventoryApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import { CodeAutocomplete, type AutocompleteItem } from '../components/CodeAutocomplete';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Meter,
  Notice,
  Select,
  StatusChip,
  type Column,
} from '../components/ui';
import type { Tone } from '../components/ui/status';
import type { AdjustQuantityInput, QuantityTransaction } from '../types';
import { getErrorMessage } from '../api/baseApi';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';
import { formatDate, formatMoney } from '../utils/format';
import ChangeHistoryTable from '../components/ChangeHistoryTable';

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
  { value: 'scraped', label: 'Scraped / broken' },
  { value: 'sold', label: 'Sold' },
];

/** Returns today as YYYY-MM-DD for the date input max attribute */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Display date, or undefined so the field shows "Not added". */
function displayDate(dateStr: string | undefined): string | undefined {
  return dateStr ? formatDate(dateStr) : undefined;
}

/** Chip tone for transaction types. */
function transactionTypeTone(type: QuantityTransaction['type']): Tone {
  switch (type) {
    case 'purchase':
    case 'challan_return':
    case 'challan_delivery_reversed':
      return 'success';
    case 'sold':
    case 'challan_delivery':
    case 'challan_return_reversed':
      return 'info';
    case 'scraped':
    case 'damaged':
    case 'short':
      return 'danger';
    default:
      return 'warning';
  }
}

/** Display label for transaction types (sentence case). */
function transactionTypeLabel(type: QuantityTransaction['type']): string {
  switch (type) {
    case 'challan_delivery':
      return 'Delivery (reserved)';
    case 'challan_return':
      return 'Return';
    case 'challan_delivery_reversed':
      return 'Delivery reversed';
    case 'challan_return_reversed':
      return 'Return reversed';
    case 'challan_loss_edit':
      return 'Challan loss edit';
    case 'challan_item_edit':
      return 'Challan item edit';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Signed quantity for a transaction: + for add/return, - for reduce/reserve.
 * challan_delivery, challan_return_reversed: Rented (items went to rented)
 * challan_return, challan_delivery_reversed: Returned (items came back)
 */
function transactionQuantity(tx: QuantityTransaction): { text: string; suffix?: string } {
  const prefix =
    tx.type === 'purchase' ||
    (tx.type === 'challan_loss_edit' && tx.note?.includes('reversed')) ||
    tx.type === 'challan_return' ||
    tx.type === 'challan_delivery_reversed'
      ? '+'
      : '-';
  const suffix =
    tx.type === 'challan_delivery' || tx.type === 'challan_return_reversed'
      ? '(rented)'
      : tx.type === 'challan_return' || tx.type === 'challan_delivery_reversed'
        ? '(returned)'
        : undefined;
  return { text: `${prefix}${tx.quantity}`, suffix };
}

/** A count in mono with its unit in the text font. */
const withUnit = (n: number, unit: string): ReactNode => (
  <>
    <span className="mono">{n}</span> {unit}
  </>
);

const notAdded = <span className="text-empty">Not added</span>;

/**
 * InventoryDetailPage displays the full details of a single inventory item.
 * Route: /inventory/:itemId
 */
export function InventoryDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const {
    data: item,
    isLoading,
    error,
    refetch,
  } = useGetInventoryItemQuery(
    { businessId: currentBusinessId!, itemId: itemId! },
    { skip: !currentBusinessId || !itemId }
  );

  const [updateInventory, { isLoading: isSaving }] = useUpdateInventoryMutation();
  const [adjustQuantity, { isLoading: isAdjusting }] = useAdjustQuantityMutation();
  const { data: openingBalances } = useGetOpeningBalancesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const itemOpeningBalance: number =
    itemId && openingBalances?.[itemId] ? Number(openingBalances[itemId]) : 0;

  const { data: existingCategories } = useGetInventoryCategoriesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  /** Stock adjustment form state */
  const [adjType, setAdjType] = useState<AdjustQuantityInput['type']>('purchase');
  const [adjQuantity, setAdjQuantity] = useState('');
  const [adjDate, setAdjDate] = useState(getTodayISO);
  const [adjNote, setAdjNote] = useState('');
  const [adjError, setAdjError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('about');

  /** Map category strings to AutocompleteItem format for CodeAutocomplete */
  const categoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    if (!existingCategories) return [];
    return existingCategories.map(cat => ({
      code: cat,
      label: cat,
      id: cat,
    }));
  }, [existingCategories]);

  /** Generic save handler for simple (flat) inventory fields. */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateInventory({
        businessId: currentBusinessId!,
        itemId: itemId!,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, itemId, updateInventory]
  );

  /** Submit a stock adjustment transaction */
  const handleAdjustQuantity = useCallback(
    async (e: FormEvent) => {
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
    [adjType, adjQuantity, adjDate, adjNote, adjustQuantity, currentBusinessId, itemId]
  );

  /** History: latest entry at top (reverse of insertion order) */
  const quantityHistory = item?.quantityHistory;
  const sortedHistory = useMemo(() => {
    if (!quantityHistory?.length) return [];
    return [...quantityHistory].reverse();
  }, [quantityHistory]);

  const tabs = item
    ? [
        { id: 'about', label: 'About' },
        { id: 'quantity-timeline', label: 'Quantity timeline', count: sortedHistory.length },
        { id: 'change-history', label: 'Change history' },
      ]
    : undefined;

  // Same numbers as the Inventory list: available ignores the opening balance, rented includes it.
  const rented = computeRentedFromHistory(item?.quantityHistory) + itemOpeningBalance;
  const available = item
    ? computeAvailable(item.totalQuantity, computeRentedFromHistory(item.quantityHistory))
    : 0;

  /** Editable money rate; empty (or zero when `hideZero`) shows "Not added". */
  const rateField = (
    label: string,
    field: 'defaultRatePerDay' | 'damageRate' | 'costPrice',
    hideZero: boolean
  ) => {
    const amount = item?.[field];
    const shown = amount != null && !(hideZero && amount <= 0);
    return (
      <DetailField
        label={label}
        value={shown ? formatMoney(amount) : undefined}
        mono
        editable={{
          rawValue: shown ? amount : undefined,
          inputType: 'number',
          prefix: '₹',
          onSave: v => handleSave(field, v),
          isSaving,
        }}
      />
    );
  };

  const sidebar = item ? (
    <DetailSection title="Details">
      <DetailField label="Code" value={item.code} mono />

      {/* Category — uses CodeAutocomplete in edit mode */}
      <DetailField
        label="Category"
        value={item.category}
        editable={{
          rawValue: item.category,
          inputType: 'text',
          onSave: v => handleSave('category', v),
          isSaving,
          renderEditInput: ({ value: editVal, onChange, onSave }) => (
            <CodeAutocomplete
              label=""
              placeholder="Select or type a category…"
              value={String(editVal)}
              onChange={val => onChange(val)}
              items={categoryAutocompleteItems}
              onSelect={selectedItem => {
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
        value={UNIT_OPTIONS.find(o => o.value === item.unit)?.label ?? item.unit}
        editable={{
          rawValue: item.unit,
          inputType: 'select',
          options: UNIT_OPTIONS,
          onSave: v => handleSave('unit', v),
          isSaving,
        }}
      />

      {rateField('Daily rate', 'defaultRatePerDay', false)}
      {/* Fixed price per unit when returned damaged */}
      {rateField('Damage charge', 'damageRate', true)}
      {/* Used when an item is lost (short) */}
      {rateField('Cost price', 'costPrice', true)}

      <DetailField label="Created" value={displayDate(item.createdAt)} />
      <DetailField label="Updated" value={displayDate(item.updatedAt)} />
    </DetailSection>
  ) : null;

  const transactionColumns: Column<QuantityTransaction>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: tx => formatDate(tx.date) },
    {
      key: 'type',
      header: 'Type',
      nowrap: true,
      render: tx => (
        <StatusChip status={tx.type} tone={transactionTypeTone(tx.type)}>
          {transactionTypeLabel(tx.type)}
        </StatusChip>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      nowrap: true,
      render: tx => {
        const q = transactionQuantity(tx);
        return (
          <>
            <span className="mono">{q.text}</span>
            {q.suffix && ` ${q.suffix}`}
          </>
        );
      },
    },
    { key: 'note', header: 'Note', render: tx => tx.note || notAdded },
  ];

  return (
    <DetailPageShell
      title={item?.name || 'Item'}
      eyebrow="Item"
      code={item?.code}
      status={item ? (item.isActive ? 'active' : 'inactive') : undefined}
      backTo="/inventory"
      backLabel="Inventory"
      isLoading={isLoading}
      loadingLabel="Loading item…"
      error={error}
      onRetry={refetch}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="inventory"
      sidebar={sidebar}
    >
      {item && (
        <>
          {activeTab === 'about' && (
            <>
              <DetailSection title="Stock">
                <Meter
                  segments={[
                    { value: available, tone: 'accent', label: 'Available' },
                    { value: rented, tone: 'info', label: 'Rented out' },
                  ]}
                />
                <DetailField
                  label="Total quantity"
                  value={withUnit(item.totalQuantity, item.unit)}
                />
                <DetailField label="Available" value={withUnit(available, item.unit)} />
                <DetailField label="Rented out" value={withUnit(rented, item.unit)} />
              </DetailSection>

              <Card title="Adjust stock">
                <form
                  aria-label="Adjust stock"
                  onSubmit={handleAdjustQuantity}
                  className={styles.adjustForm}
                >
                  <Field label="Type">
                    <Select
                      value={adjType}
                      onChange={e => setAdjType(e.target.value as AdjustQuantityInput['type'])}
                    >
                      {TRANSACTION_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Quantity" required>
                    <Input
                      type="number"
                      mono
                      min={1}
                      value={adjQuantity}
                      onChange={e => setAdjQuantity(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Date" required>
                    <Input
                      type="date"
                      value={adjDate}
                      max={getTodayISO()}
                      onChange={e => setAdjDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Note" className={styles.note}>
                    <Input
                      type="text"
                      value={adjNote}
                      onChange={e => setAdjNote(e.target.value)}
                      placeholder="e.g. batch #12"
                      maxLength={500}
                    />
                  </Field>
                  <Button type="submit" variant="primary" loading={isAdjusting}>
                    Update stock
                  </Button>
                </form>
                {adjError && (
                  <Notice tone="danger" className={styles.formError}>
                    {adjError}
                  </Notice>
                )}
              </Card>

              {item.purchaseInfo && (
                <DetailSection title="Purchase information">
                  <DetailField label="Supplier" value={item.purchaseInfo.supplierName} />
                  <DetailField
                    label="Cost per unit"
                    value={formatMoney(item.purchaseInfo.costPerUnit)}
                    mono
                  />
                  <DetailField label="Purchase date" value={displayDate(item.purchaseInfo.date)} />
                  <DetailField
                    label="Payment status"
                    value={<StatusChip status={item.purchaseInfo.paymentStatus} />}
                  />
                </DetailSection>
              )}

              <DetailSection title="Description">
                <DetailField
                  label=""
                  value={item.description || undefined}
                  editable={{
                    rawValue: item.description ?? '',
                    inputType: 'textarea',
                    onSave: v => handleSave('description', v),
                    isSaving,
                  }}
                />
              </DetailSection>
            </>
          )}

          {activeTab === 'quantity-timeline' && (
            <Card title="Quantity timeline" count={sortedHistory.length} padded={false}>
              <DataTable
                aria-label="Quantity timeline"
                columns={transactionColumns}
                rows={sortedHistory}
                rowKey={tx => tx._id}
                empty={<EmptyState title="No quantity adjustments yet" />}
                mobile={{
                  title: tx => {
                    const q = transactionQuantity(tx);
                    return (
                      <>
                        <span className="mono">{q.text}</span>
                        {q.suffix && ` ${q.suffix}`}
                      </>
                    );
                  },
                  badge: tx => (
                    <StatusChip status={tx.type} tone={transactionTypeTone(tx.type)}>
                      {transactionTypeLabel(tx.type)}
                    </StatusChip>
                  ),
                  subtitle: tx => formatDate(tx.date),
                  meta: tx => [tx.note],
                }}
              />
            </Card>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="inventory" documentId={itemId!} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
