/**
 * @fileoverview Challan detail view page
 * @description Detail page for a single challan (delivery or return): transport
 * charges and notes (inline-editable), items (inline quantity edit, add, delete),
 * loss items on returns, and change history. Built on the kit's detail recipe:
 * DetailPageShell + DetailSection/DetailField + Cards holding DataTables. A challan dated in a
 * closed financial year of its site is read only.
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './ChallanDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useAuth } from '../hooks/useAuth';
import {
  useGetChallanQuery,
  useConfirmChallanMutation,
  useUpdateChallanTransportationMutation,
  useUpdateChallanItemMutation,
  useAddChallanItemMutation,
  useDeleteChallanItemMutation,
  useDeleteChallanMutation,
  useCancelChallanMutation,
  useUpdateChallanDamagedItemsMutation,
  useUpdateChallanDateMutation,
  useLazyDownloadChallanPdfQuery,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import { CodeAutocomplete, type AutocompleteItem } from '../components/CodeAutocomplete';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  Input,
  NotAdded,
  Notice,
  RowActions,
  Select,
  StatusChip,
  TextLink,
  type Column,
} from '../components/ui';
import { useChangeGate } from '../hooks/useChangeGate';
import { useConfirm } from '../components/bulk';
import { useSiteLock } from '../hooks/useSiteLock';
import { EditableField } from '../components/EditableField';
import type { ChallanItem, DamagedItem } from '../types';
import { getErrorMessage } from '../api/baseApi';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { formatDate, formatMoney } from '../utils/format';

type LossType = NonNullable<DamagedItem['lossType']>;

const LOSS_LABEL: Record<LossType, string> = {
  damage: 'Damaged',
  short: 'Short',
  need_repair: 'Need repair',
};

/** Row types carry their list position so repeated items keep distinct keys. */
type ItemRow = ChallanItem & { idx: number };
type LossRow = DamagedItem & { idx: number };

/** `10 Nov 2026, 08:30`; missing/invalid → '' (DetailField shows "Not added"). */
function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(d)}, ${time}`;
}

/**
 * ChallanDetailPage displays the full details of a single delivery/return challan.
 * Route: /challans/:challanId
 */
export function ChallanDetailPage() {
  const { challanId } = useParams<{ challanId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const { user } = useAuth();

  const {
    data: challan,
    isLoading,
    error,
    refetch,
  } = useGetChallanQuery(
    { businessId: currentBusinessId!, challanId: challanId! },
    { skip: !currentBusinessId || !challanId }
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const { data: inventoryItems } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [updateTransportation, { isLoading: isSavingTransportation }] =
    useUpdateChallanTransportationMutation();
  const [confirmChallan, { isLoading: isConfirming }] = useConfirmChallanMutation();
  const [deleteChallan, { isLoading: isDeleting }] = useDeleteChallanMutation();
  const [cancelChallan, { isLoading: isCancelling }] = useCancelChallanMutation();
  const { ask, dialog: confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const [updateItem, { isLoading: isSavingItem }] = useUpdateChallanItemMutation();
  const [addItem, { isLoading: isAddingItem }] = useAddChallanItemMutation();
  const [deleteItem] = useDeleteChallanItemMutation();
  const [updateDamagedItems, { isLoading: isSavingDamage }] =
    useUpdateChallanDamagedItemsMutation();
  const [updateChallanDate, { isLoading: isSavingDate }] = useUpdateChallanDateMutation();
  const { run: runGated, dialog: changeDialog } = useChangeGate();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyDownloadChallanPdfQuery();
  const siteLock = useSiteLock(currentBusinessId, challan?.partyId, challan?.agreementId);
  /** Dated in a closed financial year: nothing on it can change */
  const locked = siteLock.isLocked(challan?.date);

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemData, setAddItemData] = useState<{
    itemId: string;
    itemName: string;
    quantity: number;
  } | null>(null);

  const [activeTab, setActiveTab] = useState('about');

  // Damaged items editing state
  const [editingDamage, setEditingDamage] = useState(false);
  const [localDamagedItems, setLocalDamagedItems] = useState<DamagedItem[]>([]);
  const [damageItemSearch, setDamageItemSearch] = useState<Record<number, string>>({});

  const partyName = parties?.find(p => p._id === challan?.partyId)?.name || challan?.partyId || '';

  const inventoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return (inventoryItems || []).map(item => {
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

  const handleTransportationSave = useCallback(
    async (field: string, newValue: string | number) => {
      if (!currentBusinessId || !challanId) return;

      const payload: Record<string, string | number | undefined> = {};
      payload[field] =
        typeof newValue === 'string' && newValue.trim() === '' ? undefined : newValue;

      await runGated(gate =>
        updateTransportation({
          businessId: currentBusinessId,
          challanId,
          data: payload,
          ...gate,
        }).unwrap()
      );
    },
    [currentBusinessId, challanId, updateTransportation, runGated]
  );

  const handleItemQuantitySave = useCallback(
    async (itemId: string, quantity: number) => {
      if (!currentBusinessId || !challanId) return;
      await runGated(gate =>
        updateItem({
          businessId: currentBusinessId,
          challanId,
          itemId,
          quantity,
          ...gate,
        }).unwrap()
      );
    },
    [currentBusinessId, challanId, updateItem, runGated]
  );

  const handleAddItem = useCallback(async () => {
    if (!currentBusinessId || !challanId || !addItemData) return;
    try {
      const saved = await runGated(gate =>
        addItem({
          businessId: currentBusinessId,
          challanId,
          data: addItemData,
          ...gate,
        }).unwrap()
      );
      if (!saved) return;
      setShowAddItem(false);
      setAddItemData(null);
      setAddItemSearch('');
    } catch {
      // error is handled by RTK Query
    }
  }, [currentBusinessId, challanId, addItemData, addItem, runGated]);

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!currentBusinessId || !challanId) return;
      if (!window.confirm('Delete this item from the challan?')) return;
      try {
        await runGated(gate =>
          deleteItem({
            businessId: currentBusinessId,
            challanId,
            itemId,
            ...gate,
          }).unwrap()
        );
      } catch {
        // error is handled by RTK Query
      }
    },
    [currentBusinessId, challanId, deleteItem, runGated]
  );

  const savedDamagedItems = challan?.damagedItems;
  const startEditingDamage = useCallback(() => {
    setLocalDamagedItems(
      savedDamagedItems
        ? savedDamagedItems.map(d => ({ ...d, lossType: d.lossType ?? 'damage' }))
        : []
    );
    setDamageItemSearch({});
    setEditingDamage(true);
  }, [savedDamagedItems]);

  const handleDateSave = useCallback(
    async (_field: string, newValue: string | number) => {
      if (!currentBusinessId || !challanId) return;
      await runGated(gate =>
        updateChallanDate({
          businessId: currentBusinessId,
          challanId,
          date: String(newValue),
          ...gate,
        }).unwrap()
      );
    },
    [currentBusinessId, challanId, updateChallanDate, runGated]
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!challan || !currentBusinessId) return;
    try {
      await downloadPdf({
        businessId: currentBusinessId,
        challanId: challan._id,
        fileName: `challan-${challan.challanNumber}.pdf`,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [challan, currentBusinessId, downloadPdf]);

  const handleSaveDamagedItems = useCallback(async () => {
    if (!currentBusinessId || !challanId) return;
    const filtered = localDamagedItems
      .filter(d => d.itemId)
      .map(d => ({ ...d, lossType: d.lossType ?? 'damage' }));
    try {
      const saved = await runGated(gate =>
        updateDamagedItems({
          businessId: currentBusinessId,
          challanId,
          damagedItems: filtered,
          ...gate,
        }).unwrap()
      );
      if (saved) setEditingDamage(false);
    } catch {
      // error is handled by RTK Query
    }
  }, [currentBusinessId, challanId, localDamagedItems, updateDamagedItems, runGated]);

  const handleConfirm = useCallback(async () => {
    if (!challan || !currentBusinessId) return;
    if (!confirm(`Confirm challan ${challan.challanNumber}?`)) return;
    try {
      await runGated(gate =>
        confirmChallan({
          businessId: currentBusinessId,
          challanId: challan._id,
          confirmedBy: user?.name || user?.email || 'Unknown',
          ...gate,
        }).unwrap()
      );
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [challan, currentBusinessId, confirmChallan, user, runGated]);

  const handleDelete = useCallback(() => {
    if (!challan || !currentBusinessId) return;
    ask({
      title: `Delete draft ${challan.challanNumber}?`,
      body: 'The draft is removed for good. It never moved any stock, so nothing else changes.',
      confirmLabel: 'Delete draft',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteChallan({ businessId: currentBusinessId, challanId: challan._id }).unwrap();
          navigate('/challans');
        } catch (err) {
          alert(getErrorMessage(err));
        }
      },
    });
  }, [ask, challan, currentBusinessId, deleteChallan, navigate]);

  const handleCancel = useCallback(() => {
    if (!challan || !currentBusinessId) return;
    ask({
      title: `Cancel challan ${challan.challanNumber}?`,
      body: 'Its stock moves are undone and the challan stays in the list as Cancelled, keeping its number. Bills for this site are re-checked.',
      confirmLabel: 'Cancel challan',
      cancelLabel: 'Keep challan',
      danger: true,
      // Not awaited: this dialog closes first, then the change dialog may open on its own.
      onConfirm: () => {
        runGated(gate =>
          cancelChallan({
            businessId: currentBusinessId,
            challanId: challan._id,
            ...gate,
          }).unwrap()
        ).catch(err => alert(getErrorMessage(err)));
      },
    });
  }, [ask, challan, currentBusinessId, cancelChallan, runGated]);

  const resetAddItem = () => {
    setShowAddItem(false);
    setAddItemData(null);
    setAddItemSearch('');
  };

  const updateLoss = (idx: number, patch: Partial<DamagedItem>) =>
    setLocalDamagedItems(items => items.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const tabs = challan
    ? [
        { id: 'about', label: 'About' },
        { id: 'items', label: 'Items', count: challan.items.length },
        { id: 'change-history', label: 'Change history' },
      ]
    : undefined;

  // ─── Items ────────────────────────────────────────────────────────

  const itemQuantity = (row: ItemRow) =>
    locked ? (
      <span className="mono">{row.quantity}</span>
    ) : (
      <EditableField
        label="Quantity"
        value={row.quantity}
        inputType="number"
        compact
        mono
        align="right"
        onSave={v => handleItemQuantitySave(row.itemId, Number(v))}
        isSaving={isSavingItem}
      />
    );

  const itemActions = (row: ItemRow) =>
    challan && challan.items.length > 1 && !locked ? (
      <RowActions
        items={[{ label: 'Delete', tone: 'danger', onClick: () => handleDeleteItem(row.itemId) }]}
      />
    ) : null;

  const itemColumns: Column<ItemRow>[] = [
    { key: 'itemName', header: 'Item' },
    {
      key: 'quantity',
      header: 'Quantity',
      mono: true,
      align: 'right',
      nowrap: true,
      render: itemQuantity,
    },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: itemActions },
  ];

  const itemRows: ItemRow[] = (challan?.items ?? []).map((item, idx) => ({ ...item, idx }));

  // ─── Loss items ───────────────────────────────────────────────────

  const lossAmount = (d: DamagedItem) => formatMoney(d.quantity * d.damageRate);
  const lossType = (d: DamagedItem) => LOSS_LABEL[d.lossType ?? 'damage'];
  const lossNote = (d: DamagedItem) => (d.note ? d.note : <NotAdded />);

  const lossColumns: Column<LossRow>[] = [
    { key: 'itemName', header: 'Item' },
    { key: 'type', header: 'Type', nowrap: true, render: lossType },
    { key: 'quantity', header: 'Qty', mono: true, align: 'right', nowrap: true },
    {
      key: 'rate',
      header: 'Rate',
      mono: true,
      align: 'right',
      nowrap: true,
      render: d => formatMoney(d.damageRate),
    },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: lossAmount,
    },
    { key: 'note', header: 'Note', hideOnMobile: true, render: lossNote },
  ];

  const lossRows: LossRow[] = (challan?.damagedItems ?? []).map((d, idx) => ({ ...d, idx }));

  const lossEditor = (
    <div className={styles.lossEditor}>
      {localDamagedItems.map((d, idx) => (
        <div key={idx} className={styles.lossRow}>
          <CodeAutocomplete
            label=""
            aria-label="Loss item"
            placeholder="Item code or name"
            value={damageItemSearch[idx] || d.itemName || ''}
            onChange={v => setDamageItemSearch(prev => ({ ...prev, [idx]: v }))}
            items={inventoryAutocompleteItems}
            onSelect={item => {
              const inv = inventoryItems?.find(i => i._id === item.id);
              updateLoss(idx, {
                itemId: item.id,
                itemName: inv?.name || item.label,
                damageRate: inv?.damageRate ?? d.damageRate,
              });
              setDamageItemSearch(prev => ({ ...prev, [idx]: item.code }));
            }}
          />
          <Select
            aria-label="Loss type"
            value={d.lossType ?? 'damage'}
            onChange={e => {
              const type = e.target.value as LossType;
              const inv = inventoryItems?.find(i => i._id === d.itemId);
              const rate = inv
                ? type === 'short'
                  ? (inv.costPrice ?? 0)
                  : (inv.damageRate ?? 0)
                : d.damageRate;
              updateLoss(idx, { lossType: type, damageRate: rate });
            }}
          >
            <option value="damage">Damaged</option>
            <option value="short">Short</option>
            <option value="need_repair">Need repair</option>
          </Select>
          <Input
            type="number"
            mono
            min={1}
            aria-label="Loss quantity"
            placeholder="Qty"
            value={d.quantity}
            onChange={e => updateLoss(idx, { quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            mono
            min={0}
            step="0.01"
            aria-label="Loss rate"
            placeholder="Rate"
            value={d.damageRate}
            onChange={e => updateLoss(idx, { damageRate: Number(e.target.value) })}
          />
          <Input
            type="text"
            aria-label="Loss note"
            placeholder="Note"
            value={d.note || ''}
            onChange={e => updateLoss(idx, { note: e.target.value })}
          />
          <Button
            variant="ghost"
            onClick={() => setLocalDamagedItems(items => items.filter((_, i) => i !== idx))}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className={styles.editActions}>
        <Button
          icon="plus"
          onClick={() =>
            setLocalDamagedItems(items => [
              ...items,
              {
                itemId: '',
                itemName: '',
                quantity: 1,
                damageRate: 0,
                note: '',
                lossType: 'damage',
              },
            ])
          }
        >
          Add loss item
        </Button>
        <Button variant="primary" onClick={handleSaveDamagedItems} loading={isSavingDamage}>
          Save
        </Button>
        <Button onClick={() => setEditingDamage(false)}>Cancel</Button>
      </div>
    </div>
  );

  // ─── Shell ────────────────────────────────────────────────────────

  const sidebar = challan ? (
    <DetailSection title="Details">
      <DetailField label="Challan number" value={challan.challanNumber} mono />
      <DetailField label="Type" value={<StatusChip status={challan.type} />} />
      <DetailField
        label="Party"
        value={<TextLink to={`/parties/${challan.partyId}`}>{partyName}</TextLink>}
      />
      <DetailField
        label="Agreement"
        value={
          <DocNumber wrap value={challan.agreementId} to={`/agreements/${challan.agreementId}`} />
        }
      />
      <DetailField
        label="Date"
        value={formatDate(challan.date)}
        editable={
          locked
            ? undefined
            : {
                rawValue: challan.date ? new Date(challan.date).toISOString().split('T')[0] : '',
                inputType: 'date',
                onSave: v => handleDateSave('date', v),
                isSaving: isSavingDate,
              }
        }
      />
      <DetailField label="Confirmed by" value={challan.confirmedBy} />
      <DetailField label="Confirmed at" value={formatDateTime(challan.confirmedAt)} />
      <DetailField label="Created" value={formatDateTime(challan.createdAt)} />
    </DetailSection>
  ) : null;

  const chargeField = (
    label: string,
    field: 'cartageCharge' | 'loadingCharge' | 'unloadingCharge'
  ) =>
    challan && (
      <DetailField
        label={label}
        value={challan[field] != null ? formatMoney(challan[field]) : undefined}
        mono
        editable={
          locked
            ? undefined
            : {
                rawValue: challan[field],
                inputType: 'number',
                prefix: '₹',
                onSave: v => handleTransportationSave(field, v),
                isSaving: isSavingTransportation,
              }
        }
      />
    );

  const textField = (label: string, field: 'transporterName' | 'vehicleNumber', mono = false) =>
    challan && (
      <DetailField
        label={label}
        value={challan[field]}
        mono={mono}
        editable={
          locked
            ? undefined
            : {
                rawValue: challan[field],
                inputType: 'text',
                onSave: v => handleTransportationSave(field, v),
                isSaving: isSavingTransportation,
              }
        }
      />
    );

  const isDraft = challan?.status === 'draft';

  return (
    <DetailPageShell
      recordNoun="challan"
      title={challan?.challanNumber || 'Challan'}
      status={challan?.status}
      backTo="/challans"
      backLabel="Challans"
      isLoading={isLoading}
      loadingLabel="Loading challan…"
      error={error}
      onRetry={refetch}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="challan"
      sidebar={sidebar}
      headerActions={
        challan && currentBusinessId ? (
          <>
            <Button
              variant={isDraft ? 'secondary' : 'primary'}
              onClick={handleDownloadPdf}
              loading={isDownloading}
            >
              Download PDF
            </Button>
            {isDraft && (
              <Button variant="ghost" onClick={handleDelete} loading={isDeleting}>
                Delete
              </Button>
            )}
            {challan.status === 'confirmed' && (
              <Button
                variant="ghost"
                onClick={handleCancel}
                loading={isCancelling}
                disabled={locked}
              >
                Cancel challan
              </Button>
            )}
            {isDraft && (
              <Button
                variant="primary"
                onClick={handleConfirm}
                loading={isConfirming}
                disabled={locked}
              >
                Confirm
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {challan && (
        <>
          {locked && <Notice tone="warning">{siteLock.message}</Notice>}
          {activeTab === 'about' && (
            <>
              <DetailSection title="Transportation">
                {textField('Transporter', 'transporterName')}
                {textField('Vehicle number', 'vehicleNumber', true)}
                {chargeField('Cartage charge', 'cartageCharge')}
                {chargeField('Loading charge', 'loadingCharge')}
                {chargeField('Unloading charge', 'unloadingCharge')}
              </DetailSection>

              <DetailSection title="Notes">
                <DetailField label="" value={challan.notes || undefined} />
              </DetailSection>

              {challan.signature && (
                <DetailSection title="Signature">
                  <DetailField label="" value={challan.signature} />
                </DetailSection>
              )}
            </>
          )}

          {activeTab === 'items' && (
            <>
              <Card
                title="Items"
                count={challan.items.length}
                padded={false}
                actions={
                  !showAddItem && (
                    <Button
                      size="sm"
                      icon="plus"
                      onClick={() => setShowAddItem(true)}
                      disabled={locked}
                    >
                      Add item
                    </Button>
                  )
                }
              >
                <DataTable
                  aria-label="Items"
                  columns={itemColumns}
                  rows={itemRows}
                  rowKey={r => `${r.itemId}-${r.idx}`}
                  empty={<EmptyState title="No items in this challan" />}
                  mobile={{
                    title: r => r.itemName,
                    meta: r => [
                      <span key="qty" className={styles.inline}>
                        Qty {itemQuantity(r)}
                      </span>,
                    ],
                    actions: itemActions,
                    actionsPlacement: 'trailing',
                  }}
                />
                {showAddItem && (
                  <div className={styles.addRow}>
                    <div className={styles.grow}>
                      <CodeAutocomplete
                        label=""
                        aria-label="Item to add"
                        placeholder="Item code or name"
                        value={addItemSearch}
                        onChange={setAddItemSearch}
                        items={inventoryAutocompleteItems}
                        onSelect={item => {
                          const inv = inventoryItems?.find(i => i._id === item.id);
                          setAddItemData({
                            itemId: item.id,
                            itemName: inv?.name || item.label,
                            quantity: 1,
                          });
                          setAddItemSearch(item.code);
                        }}
                      />
                    </div>
                    {addItemData && (
                      <div className={styles.qty}>
                        <Input
                          type="number"
                          mono
                          min={1}
                          aria-label="Quantity to add"
                          value={addItemData.quantity}
                          onChange={e =>
                            setAddItemData({ ...addItemData, quantity: Number(e.target.value) })
                          }
                        />
                      </div>
                    )}
                    <Button
                      variant="primary"
                      onClick={handleAddItem}
                      disabled={!addItemData}
                      loading={isAddingItem}
                    >
                      Add
                    </Button>
                    <Button onClick={resetAddItem}>Cancel</Button>
                  </div>
                )}
              </Card>

              {challan.type === 'return' && (
                <Card
                  title="Loss items"
                  count={lossRows.length}
                  padded={editingDamage}
                  actions={
                    !editingDamage && (
                      <Button size="sm" onClick={startEditingDamage} disabled={locked}>
                        Edit loss items
                      </Button>
                    )
                  }
                >
                  {editingDamage ? (
                    lossEditor
                  ) : (
                    <DataTable
                      aria-label="Loss items"
                      columns={lossColumns}
                      rows={lossRows}
                      rowKey={r => `${r.itemId}-${r.idx}`}
                      empty={<EmptyState title="No loss items recorded" />}
                      mobile={{
                        title: r => r.itemName,
                        badge: r => lossType(r),
                        meta: r => [
                          <span key="qty" className="mono">
                            {r.quantity} × {formatMoney(r.damageRate)}
                          </span>,
                          <span key="amount" className="mono">
                            {lossAmount(r)}
                          </span>,
                          r.note,
                        ],
                      }}
                    />
                  )}
                </Card>
              )}
            </>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="challan" documentId={challanId!} />
          )}
        </>
      )}
      {changeDialog}
      {confirmDialog}
    </DetailPageShell>
  );
}
