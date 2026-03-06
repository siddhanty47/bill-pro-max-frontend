/**
 * @fileoverview Challan detail view page
 * @description Detail page showing all information for a single
 * challan (delivery or return), including editable items, damaged items,
 * vehicle details, and notes.
 */
import { useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetChallanQuery,
  useUpdateChallanTransportationMutation,
  useUpdateChallanItemMutation,
  useAddChallanItemMutation,
  useDeleteChallanItemMutation,
  useUpdateChallanDamagedItemsMutation,
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

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemData, setAddItemData] = useState<{ itemId: string; itemName: string; quantity: number } | null>(null);

  // Damaged items editing state
  const [editingDamage, setEditingDamage] = useState(false);
  const [localDamagedItems, setLocalDamagedItems] = useState<DamagedItem[]>([]);
  const [damageItemSearch, setDamageItemSearch] = useState<Record<number, string>>({});

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
            style={{ color: '#0066cc', textDecoration: 'none' }}
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
            style={{ color: '#0066cc', textDecoration: 'none' }}
          >
            {challan.agreementId}
          </Link>
        }
      />
      <DetailField label="Date" value={formatDate(challan.date)} />
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
    >
      {challan && (
        <>
          {/* Items */}
          <DetailSection title={`Items (${challan.items.length})`}>
            {challan.items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {challan.items.map((item, idx) => (
                    <tr key={`${item.itemId}-${idx}`}>
                      <td>{item.itemName}</td>
                      <td>
                        {editingItemId === item.itemId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                              style={{ width: 70, padding: '2px 6px' }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleItemQuantitySave(item.itemId)}
                              disabled={isSavingItem}
                              style={{ padding: '2px 6px', cursor: 'pointer', fontSize: 14 }}
                              title="Save"
                            >
                              {isSavingItem ? '...' : '✓'}
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              disabled={isSavingItem}
                              style={{ padding: '2px 6px', cursor: 'pointer', fontSize: 14 }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            onClick={() => { setEditingItemId(item.itemId); setEditQty(item.quantity); }}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed #999', paddingBottom: 1 }}
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
                            style={{ padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}
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
              <p style={{ color: '#999', fontStyle: 'italic' }}>No items in this challan.</p>
            )}

            {/* Add item row */}
            {showAddItem ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 2 }}>
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
                    style={{ width: 70, padding: '4px 6px' }}
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
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8 }}
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
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 2 }}>
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
                          const updated = [...localDamagedItems];
                          updated[idx] = {
                            ...updated[idx],
                            lossType: e.target.value as 'damage' | 'short' | 'need_repair',
                          };
                          setLocalDamagedItems(updated);
                        }}
                        style={{ width: 110, padding: '4px 6px' }}
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
                        style={{ width: 70, padding: '4px 6px' }}
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
                        style={{ width: 90, padding: '4px 6px' }}
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
                        style={{ flex: 1, padding: '4px 6px' }}
                      />
                      <button
                        onClick={() => {
                          const updated = [...localDamagedItems];
                          updated.splice(idx, 1);
                          setLocalDamagedItems(updated);
                        }}
                        style={{ padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                            <td style={{ color: d.note ? '#333' : '#999', fontStyle: d.note ? 'normal' : 'italic' }}>
                              {d.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No loss items recorded.</p>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={startEditingDamage}
                  >
                    Edit Loss Items
                  </button>
                </>
              )}
            </DetailSection>
          )}

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
            <p style={{ color: challan.notes ? '#333' : '#999', fontStyle: challan.notes ? 'normal' : 'italic' }}>
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
    </DetailPageShell>
  );
}
