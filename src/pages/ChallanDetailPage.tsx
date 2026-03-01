/**
 * @fileoverview Challan detail view page
 * @description Detail page showing all information for a single
 * challan (delivery or return), including editable items, vehicle details, and notes.
 */
import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetChallanQuery,
  useUpdateChallanTransportationMutation,
  useUpdateChallanItemMutation,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';

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
  const [updateTransportation, { isLoading: isSavingTransportation }] =
    useUpdateChallanTransportationMutation();
  const [updateItem, { isLoading: isSavingItem }] = useUpdateChallanItemMutation();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);

  const partyName = parties?.find((p) => p._id === challan?.partyId)?.name || challan?.partyId || '';

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
                    <th>Condition</th>
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
                        <span className={`status status-${item.condition === 'good' ? 'active' : item.condition === 'damaged' ? 'overdue' : 'cancelled'}`}>
                          {item.condition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No items in this challan.</p>
            )}
          </DetailSection>

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
