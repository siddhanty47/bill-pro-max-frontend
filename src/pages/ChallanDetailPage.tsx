/**
 * @fileoverview Challan detail view page
 * @description Detail page showing all information for a single
 * challan (delivery or return), including editable items, damaged items,
 * vehicle details, and notes.
 */
import { useState, useCallback, useMemo } from 'react';
import { Tabs } from '../components/Tabs';
import { useParams, Link } from 'react-router-dom';
import pageStyles from './ChallanDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetChallanQuery,
  useUpdateChallanTransportationMutation,
  useUpdateChallanItemMutation,
  useAddChallanItemMutation,
  useDeleteChallanItemMutation,
  useUpdateChallanDamagedItemsMutation,
  useUpdateChallanDateMutation,
  useLazyGetChallanPdfQuery,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { CodeAutocomplete, type AutocompleteItem } from '../components/CodeAutocomplete';
import type { DamagedItem } from '../types';
import { getErrorMessage } from '../api/baseApi';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';

/**
 * Formats an ISO date string for display.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Formats an ISO datetime string including time.
 */
function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

/**
 * ChallanDetailPage displays the full details of a single delivery/return challan.
 * Route: /challans/:challanId
 */
export function ChallanDetailPage() {
  const { challanId } = useParams<{ challanId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const { data: challan, isLoading, error, refetch } = useGetChallanQuery(
    { businessId: currentBusinessId!, challanId: challanId! },
    { skip: !currentBusinessId || !challanId },
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const { data: inventoryItems } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [updateTransportation, { isLoading: isSavingTransportation }] =
    useUpdateChallanTransportationMutation();
  const [updateItem, { isLoading: isSavingItem }] = useUpdateChallanItemMutation();
  const [addItem, { isLoading: isAddingItem }] = useAddChallanItemMutation();
  const [deleteItem] = useDeleteChallanItemMutation();
  const [updateDamagedItems, { isLoading: isSavingDamage }] = useUpdateChallanDamagedItemsMutation();
  const [updateChallanDate, { isLoading: isSavingDate }] = useUpdateChallanDateMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyGetChallanPdfQuery();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemData, setAddItemData] = useState<{ itemId: string; itemName: string; quantity: number } | null>(null);

  const [activeTab, setActiveTab] = useState('about');

  // Damaged items editing state
  const [editingDamage, setEditingDamage] = useState(false);
  const [localDamagedItems, setLocalDamagedItems] = useState<DamagedItem[]>([]);
  const [damageItemSearch, setDamageItemSearch] = useState<Record<number, string>>({});

  const TABS = [
    { id: 'about', label: 'About' },
    { id: 'items', label: 'Items' },
  ];

  const partyName = parties?.find((p) => p._id === challan?.partyId)?.name || challan?.partyId || '';

  const inventoryAutocompleteItems: AutocompleteItem[] = useMemo(() => {
    return (inventoryItems || []).map((item) => {
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

      await updateTransportation({
        businessId: currentBusinessId,
        challanId,
        data: payload,
      }).unwrap();
    },
    [currentBusinessId, challanId, updateTransportation]
  );

  const handleItemQuantitySave = useCallback(
    async (itemId: string) => {
      if (!currentBusinessId || !challanId) return;
      try {
        await updateItem({
          businessId: currentBusinessId,
          challanId,
          itemId,
          quantity: editQty,
        }).unwrap();
        setEditingItemId(null);
      } catch {
        // error is handled by RTK Query
      }
    },
    [currentBusinessId, challanId, editQty, updateItem]
  );

  const handleAddItem = useCallback(async () => {
    if (!currentBusinessId || !challanId || !addItemData) return;
    try {
      await addItem({
        businessId: currentBusinessId,
        challanId,
        data: addItemData,
      }).unwrap();
      setShowAddItem(false);
      setAddItemData(null);
      setAddItemSearch('');
    } catch {
      // error is handled by RTK Query
    }
  }, [currentBusinessId, challanId, addItemData, addItem]);

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!currentBusinessId || !challanId) return;
      if (!window.confirm('Delete this item from the challan?')) return;
      try {
        await deleteItem({
          businessId: currentBusinessId,
          challanId,
          itemId,
        }).unwrap();
      } catch {
        // error is handled by RTK Query
      }
    },
    [currentBusinessId, challanId, deleteItem]
  );

  const startEditingDamage = useCallback(() => {
    setLocalDamagedItems(
      challan?.damagedItems
        ? challan.damagedItems.map((d) => ({ ...d, lossType: d.lossType ?? 'damage' }))
        : []
    );
    setDamageItemSearch({});
    setEditingDamage(true);
  }, [challan?.damagedItems]);

  const handleDateSave = useCallback(
    async (_field: string, newValue: string | number) => {
      if (!currentBusinessId || !challanId) return;
      await updateChallanDate({
        businessId: currentBusinessId,
        challanId,
        date: String(newValue),
      }).unwrap();
    },
    [currentBusinessId, challanId, updateChallanDate]
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!challan || !currentBusinessId) return;
    try {
      const blob = await downloadPdf({
        businessId: currentBusinessId,
        challanId: challan._id,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challan-${challan.challanNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [challan, currentBusinessId, downloadPdf]);

  const handleSaveDamagedItems = useCallback(async () => {
    if (!currentBusinessId || !challanId) return;
    const filtered = localDamagedItems
      .filter((d) => d.itemId)
      .map((d) => ({ ...d, lossType: d.lossType ?? 'damage' }));
    try {
      await updateDamagedItems({
        businessId: currentBusinessId,
        challanId,
        damagedItems: filtered,
      }).unwrap();
      setEditingDamage(false);
    } catch {
      // error is handled by RTK Query
    }
  }, [currentBusinessId, challanId, localDamagedItems, updateDamagedItems]);

  const sidebar = challan ? (
    <DetailSection title="Details">
      <DetailField label="Challan Number" value={challan.challanNumber} />
      <DetailField
        label="Type"
        value={
          <span className={`status status-${challan.type}`}>
            {challan.type}
          </span>
        }
      />
      <DetailField
        label="Status"
        value={
          <span className={`status status-${challan.status}`}>
            {challan.status}
          </span>
        }
      />
      <DetailField
        label="Party"
        value={
          <Link
            to={`/parties/${challan.partyId}`}
            className="link-accent"
          >
            {partyName}
          </Link>
        }
      />
      <DetailField
        label="Agreement"
        value={
          <Link
            to={`/agreements/${challan.agreementId}`}
            className="link-accent"
          >
            {challan.agreementId}
          </Link>
        }
      />
      <DetailField
        label="Date"
        value={formatDate(challan.date)}
        editable={{
          rawValue: challan.date ? new Date(challan.date).toISOString().split('T')[0] : '',
          inputType: 'date',
          onSave: (v) => handleDateSave('date', v),
          isSaving: isSavingDate,
        }}
      />
      <DetailField label="Confirmed By" value={challan.confirmedBy} />
      <DetailField label="Confirmed At" value={formatDateTime(challan.confirmedAt)} />
      <DetailField label="Created" value={formatDateTime(challan.createdAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={challan?.challanNumber || 'Challan'}
      subtitle={partyName ? `Party: ${partyName}` : undefined}
      status={challan?.status}
      statusClassName={`status status-${challan?.status}`}
      backTo="/challans"
      backLabel="Challans"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
      headerActions={
        challan && currentBusinessId ? (
          <button
            className="btn btn-primary"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-inline">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
        ) : undefined
      }
    >
      {challan && (
        <>
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'items' && (
            <>
          {/* Items */}
          <DetailSection title={`Items (${challan.items.length})`}>
            {challan.items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th className={pageStyles.colActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {challan.items.map((item, idx) => (
                    <tr key={`${item.itemId}-${idx}`}>
                      <td>{item.itemName}</td>
                      <td>
                        {editingItemId === item.itemId ? (
                          <span className={pageStyles.statusBadge}>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={editQty}
                              onChange={(e) => setEditQty(Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleItemQuantitySave(item.itemId);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              disabled={isSavingItem}
                              className={pageStyles.inputSmall}
                              autoFocus
                            />
                            <button
                              onClick={() => handleItemQuantitySave(item.itemId)}
                              disabled={isSavingItem}
                              className={pageStyles.inlineSaveBtn}
                              title="Save (Enter)"
                            >
                              {isSavingItem ? '...' : '[ok]'}
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              disabled={isSavingItem}
                              className={pageStyles.inlineSaveBtn}
                              title="Cancel (Esc)"
                            >
                              [x]
                            </button>
                          </span>
                        ) : (
                          <span
                            onClick={() => { setEditingItemId(item.itemId); setEditQty(item.quantity); }}
                            className={pageStyles.editableText}
                            title="Click to edit"
                          >
                            {item.quantity}
                          </span>
                        )}
                      </td>
                      <td>
                        {challan.items.length > 1 && (
                          <button
                            onClick={() => handleDeleteItem(item.itemId)}
                            className={pageStyles.inlineDeleteBtn}
                            title="Delete item"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-empty">No items in this challan.</p>
            )}

            {/* Add item row */}
            {showAddItem ? (
              <div className={pageStyles.inlineEditRow}>
                <div className={pageStyles.flexGrow2}>
                  <CodeAutocomplete
                    label=""
                    placeholder="Type item code or name..."
                    value={addItemSearch}
                    onChange={setAddItemSearch}
                    items={inventoryAutocompleteItems}
                    onSelect={(item) => {
                      const inv = inventoryItems?.find((i) => i._id === item.id);
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
                  <input
                    type="number"
                    min={1}
                    value={addItemData.quantity}
                    onChange={(e) => setAddItemData({ ...addItemData, quantity: Number(e.target.value) })}
                    className={pageStyles.inputSmall}
                  />
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddItem}
                  disabled={!addItemData || isAddingItem}
                >
                  {isAddingItem ? '...' : 'Add'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowAddItem(false); setAddItemData(null); setAddItemSearch(''); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={`btn btn-secondary btn-sm ${pageStyles.marginTop8}`}
                onClick={() => setShowAddItem(true)}
              >
                + Add Item
              </button>
            )}
          </DetailSection>

          {/* Loss (return challans only) */}
          {challan.type === 'return' && (
            <DetailSection title="Loss">
              {editingDamage ? (
                <>
                  {localDamagedItems.map((d, idx) => (
                    <div key={idx} className={pageStyles.inlineEditRowBottom}>
                      <div className={pageStyles.flexGrow2}>
                        <CodeAutocomplete
                          label=""
                          placeholder="Item..."
                          value={damageItemSearch[idx] || d.itemName || ''}
                          onChange={(v) => setDamageItemSearch((prev) => ({ ...prev, [idx]: v }))}
                          items={inventoryAutocompleteItems}
                          onSelect={(item) => {
                            const inv = inventoryItems?.find((i) => i._id === item.id);
                            const updated = [...localDamagedItems];
                            updated[idx] = {
                              ...updated[idx],
                              itemId: item.id,
                              itemName: inv?.name || item.label,
                              damageRate: inv?.damageRate ?? updated[idx].damageRate,
                            };
                            setLocalDamagedItems(updated);
                            setDamageItemSearch((prev) => ({ ...prev, [idx]: item.code }));
                          }}
                        />
                      </div>
                      <select
                        value={d.lossType ?? 'damage'}
                        onChange={(e) => {
                          const lossType = e.target.value as 'damage' | 'short' | 'need_repair';
                          const inv = inventoryItems?.find((i) => i._id === d.itemId);
                          const rate = inv
                            ? (lossType === 'short' ? (inv.costPrice ?? 0) : (inv.damageRate ?? 0))
                            : d.damageRate;
                          const updated = [...localDamagedItems];
                          updated[idx] = {
                            ...updated[idx],
                            lossType,
                            damageRate: rate,
                          };
                          setLocalDamagedItems(updated);
                        }}
                        className={pageStyles.inputMedium}
                      >
                        <option value="damage">Damaged</option>
                        <option value="short">Short</option>
                        <option value="need_repair">Need Repair</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={d.quantity}
                        onChange={(e) => {
                          const updated = [...localDamagedItems];
                          updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                          setLocalDamagedItems(updated);
                        }}
                        className={pageStyles.inputSmall}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Rate"
                        value={d.damageRate}
                        onChange={(e) => {
                          const updated = [...localDamagedItems];
                          updated[idx] = { ...updated[idx], damageRate: Number(e.target.value) };
                          setLocalDamagedItems(updated);
                        }}
                        className={pageStyles.inputSmMd}
                      />
                      <input
                        type="text"
                        placeholder="Note"
                        value={d.note || ''}
                        onChange={(e) => {
                          const updated = [...localDamagedItems];
                          updated[idx] = { ...updated[idx], note: e.target.value };
                          setLocalDamagedItems(updated);
                        }}
                        className={pageStyles.flexGrow1}
                      />
                      <button
                        onClick={() => {
                          const updated = [...localDamagedItems];
                          updated.splice(idx, 1);
                          setLocalDamagedItems(updated);
                        }}
                        className={pageStyles.inlineDeleteBtn}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className={pageStyles.inlineEditRow}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setLocalDamagedItems([
                          ...localDamagedItems,
                          { itemId: '', itemName: '', quantity: 1, damageRate: 0, note: '', lossType: 'damage' },
                        ]);
                      }}
                    >
                      + Add Loss Item
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveDamagedItems}
                      disabled={isSavingDamage}
                    >
                      {isSavingDamage ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingDamage(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {challan.damagedItems && challan.damagedItems.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {challan.damagedItems.map((d, idx) => (
                          <tr key={`${d.itemId}-${idx}`}>
                            <td>{d.itemName}</td>
                            <td>
                              {d.lossType === 'short'
                                ? 'Short'
                                : d.lossType === 'need_repair'
                                  ? 'Need Repair'
                                  : 'Damaged'}
                            </td>
                            <td>{d.quantity}</td>
                            <td>₹{d.damageRate}</td>
                            <td>₹{(d.quantity * d.damageRate).toLocaleString()}</td>
                            <td className={d.note ? 'text-notes' : 'text-notes-empty'}>
                              {d.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-empty">No loss items recorded.</p>
                  )}
                  <button
                    className={`btn btn-secondary btn-sm ${pageStyles.marginTop8}`}
                    onClick={startEditingDamage}
                  >
                    Edit Loss Items
                  </button>
                </>
              )}
            </DetailSection>
          )}
            </>
          )}

          {activeTab === 'about' && (
            <>
          {/* Transportation */}
          <DetailSection title="Transportation">
            <DetailField
              label="Transporter"
              value={challan.transporterName}
              editable={{
                rawValue: challan.transporterName,
                inputType: 'text',
                onSave: (v) => handleTransportationSave('transporterName', v),
                isSaving: isSavingTransportation,
              }}
            />
            <DetailField
              label="Vehicle Number"
              value={challan.vehicleNumber}
              editable={{
                rawValue: challan.vehicleNumber,
                inputType: 'text',
                onSave: (v) => handleTransportationSave('vehicleNumber', v),
                isSaving: isSavingTransportation,
              }}
            />
            <DetailField
              label="Cartage Charge"
              value={
                challan.cartageCharge != null
                  ? `₹${challan.cartageCharge.toLocaleString()}`
                  : undefined
              }
              editable={{
                rawValue: challan.cartageCharge,
                inputType: 'number',
                prefix: '₹',
                onSave: (v) => handleTransportationSave('cartageCharge', v),
                isSaving: isSavingTransportation,
              }}
            />
            <DetailField
              label="Loading Charge"
              value={
                challan.loadingCharge != null
                  ? `₹${challan.loadingCharge.toLocaleString()}`
                  : undefined
              }
              editable={{
                rawValue: challan.loadingCharge,
                inputType: 'number',
                prefix: '₹',
                onSave: (v) => handleTransportationSave('loadingCharge', v),
                isSaving: isSavingTransportation,
              }}
            />
            <DetailField
              label="Unloading Charge"
              value={
                challan.unloadingCharge != null
                  ? `₹${challan.unloadingCharge.toLocaleString()}`
                  : undefined
              }
              editable={{
                rawValue: challan.unloadingCharge,
                inputType: 'number',
                prefix: '₹',
                onSave: (v) => handleTransportationSave('unloadingCharge', v),
                isSaving: isSavingTransportation,
              }}
            />
          </DetailSection>

          {/* Notes */}
          <DetailSection title="Notes">
            <p className={challan.notes ? 'text-notes' : 'text-notes-empty'}>
              {challan.notes || 'No notes.'}
            </p>
          </DetailSection>

          {/* Signature */}
          {challan.signature && (
            <DetailSection title="Signature">
              <p>{challan.signature}</p>
            </DetailSection>
          )}
            </>
          )}
        </>
      )}
    </DetailPageShell>
  );
}
