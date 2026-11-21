/**
 * @fileoverview Payment detail view page
 * @description Read-only detail page for a single payment: amount, type, method,
 * reference, linked party and bill, notes and change history. Built on the kit's
 * detail recipe.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetPaymentQuery } from '../api/paymentApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import { DocNumber, TextLink } from '../components/ui';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { formatDate, formatMoney } from '../utils/format';
import type { Payment } from '../types';

const METHOD_LABEL: Record<Payment['method'], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  other: 'Other',
};

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'change-history', label: 'Change history' },
];

/**
 * PaymentDetailPage displays the full details of a single payment record.
 * Route: /payments/:paymentId
 */
export function PaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const {
    data: payment,
    isLoading,
    error,
    refetch,
  } = useGetPaymentQuery(
    { businessId: currentBusinessId!, paymentId: paymentId! },
    { skip: !currentBusinessId || !paymentId }
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [activeTab, setActiveTab] = useState('about');

  const partyName = parties?.find(p => p._id === payment?.partyId)?.name || payment?.partyId || '';

  const sidebar = payment ? (
    <DetailSection title="Details">
      <DetailField label="Type" value={payment.type === 'receivable' ? 'Received' : 'Paid'} />
      <DetailField label="Amount" value={formatMoney(payment.amount)} mono />
      <DetailField label="Currency" value={payment.currency} />
      <DetailField label="Method" value={METHOD_LABEL[payment.method] ?? payment.method} />
      <DetailField label="Reference" value={payment.reference} mono />
      <DetailField
        label="Party"
        value={<TextLink to={`/parties/${payment.partyId}`}>{partyName}</TextLink>}
      />
      {payment.billId && (
        <DetailField
          label="Bill"
          value={<DocNumber wrap value={payment.billId} to={`/bills/${payment.billId}`} />}
        />
      )}
      <DetailField label="Date" value={formatDate(payment.date)} />
      <DetailField label="Created" value={formatDate(payment.createdAt)} />
      <DetailField label="Updated" value={formatDate(payment.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      recordNoun="payment"
      title={payment ? formatMoney(payment.amount) : 'Payment'}
      status={payment?.status}
      backTo="/payments"
      backLabel="Payments"
      isLoading={isLoading}
      loadingLabel="Loading payment…"
      error={error}
      onRetry={refetch}
      tabs={payment ? TABS : undefined}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="payment"
      sidebar={sidebar}
    >
      {payment && activeTab === 'about' && (
        <DetailSection title="Notes">
          <DetailField label="" value={payment.notes || undefined} />
        </DetailSection>
      )}

      {payment && activeTab === 'change-history' && (
        <ChangeHistoryTable documentType="payment" documentId={paymentId!} />
      )}
    </DetailPageShell>
  );
}
