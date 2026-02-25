/**
 * @fileoverview Payment detail view page
 * @description Read-only detail page showing all information for a single payment,
 * including type, method, amount, linked bill, and notes.
 */
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetPaymentQuery } from '../api/paymentApi';
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
 * Formats a payment method enum value for display.
 */
function formatMethod(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * PaymentDetailPage displays the full details of a single payment record.
 * Route: /payments/:paymentId
 */
export function PaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const { data: payment, isLoading, error, refetch } = useGetPaymentQuery(
    { businessId: currentBusinessId!, paymentId: paymentId! },
    { skip: !currentBusinessId || !paymentId },
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const partyName =
    parties?.find((p) => p._id === payment?.partyId)?.name || payment?.partyId || '';

  const sidebar = payment ? (
    <DetailSection title="Details">
      <DetailField
        label="Type"
        value={
          <span className={`status status-${payment.type === 'receivable' ? 'active' : 'pending'}`}>
            {payment.type === 'receivable' ? 'Received' : 'Paid'}
          </span>
        }
      />
      <DetailField
        label="Status"
        value={
          <span className={`status status-${payment.status}`}>
            {payment.status}
          </span>
        }
      />
      <DetailField
        label="Amount"
        value={<strong>{`₹${payment.amount.toLocaleString()}`}</strong>}
      />
      <DetailField label="Currency" value={payment.currency} />
      <DetailField label="Method" value={formatMethod(payment.method)} />
      <DetailField label="Reference" value={payment.reference} />
      <DetailField
        label="Party"
        value={
          <Link
            to={`/parties/${payment.partyId}`}
            style={{ color: '#0066cc', textDecoration: 'none' }}
          >
            {partyName}
          </Link>
        }
      />
      {payment.billId && (
        <DetailField
          label="Bill"
          value={
            <Link
              to={`/bills/${payment.billId}`}
              style={{ color: '#0066cc', textDecoration: 'none' }}
            >
              {payment.billId}
            </Link>
          }
        />
      )}
      <DetailField label="Date" value={formatDate(payment.date)} />
      <DetailField label="Created" value={formatDateTime(payment.createdAt)} />
      <DetailField label="Updated" value={formatDateTime(payment.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={payment ? `₹${payment.amount.toLocaleString()}` : 'Payment'}
      subtitle={partyName ? `Party: ${partyName}` : undefined}
      status={payment?.status}
      statusClassName={`status status-${payment?.status}`}
      backTo="/payments"
      backLabel="Payments"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {payment && (
        <DetailSection title="Notes">
          <p
            style={{
              color: payment.notes ? '#333' : '#999',
              fontStyle: payment.notes ? 'normal' : 'italic',
            }}
          >
            {payment.notes || 'No notes.'}
          </p>
        </DetailSection>
      )}
    </DetailPageShell>
  );
}
