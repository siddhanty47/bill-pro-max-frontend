/**
 * @fileoverview Challan detail view page
 * @description Read-only detail page showing all information for a single
 * challan (delivery or return), including items, vehicle details, and notes.
 */
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetChallanQuery } from '../api/challanApi';
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

  const partyName = parties?.find((p) => p._id === challan?.partyId)?.name || challan?.partyId || '';

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
                      <td>{item.quantity}</td>
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
