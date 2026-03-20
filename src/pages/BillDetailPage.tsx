/**
 * @fileoverview Bill detail view page
 * @description Detail page showing all information for a single bill, including
 * line items, financial summary, and payment status. Supports Jira-style inline
 * editing for the bill status field and stale-bill regeneration.
 */
import { useCallback, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import pageStyles from './BillDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetBillQuery,
  useUpdateBillStatusMutation,
  useDeleteBillMutation,
  useGenerateBillMutation,
  useSendBillEmailMutation,
  useLazyGetBillPdfQuery,
} from '../api/billApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetPaymentsByBillQuery } from '../api/paymentApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { getErrorMessage } from '../api/baseApi';
import type { Bill } from '../types';

/** Bill status options — matches the Bill type union */
const BILL_STATUS_OPTIONS: { value: Bill['status']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Formats an ISO date string for display.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Formats a currency amount with the rupee symbol.
 */
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString()}`;
}

/**
 * BillDetailPage displays the full details of a single bill/invoice.
 * Route: /bills/:billId
 */
export function BillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();

  const { data: bill, isLoading, error, refetch } = useGetBillQuery(
    { businessId: currentBusinessId!, billId: billId! },
    { skip: !currentBusinessId || !billId },
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: payments } = useGetPaymentsByBillQuery(
    { businessId: currentBusinessId!, billId: billId! },
    { skip: !currentBusinessId || !billId },
  );

  const [updateBillStatus, { isLoading: isSaving }] = useUpdateBillStatusMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [generateBill] = useGenerateBillMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyGetBillPdfQuery();
  const [sendBillEmail, { isLoading: isSending }] = useSendBillEmailMutation();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const partyName = parties?.find((p) => p._id === bill?.partyId)?.name || bill?.partyId || '';
  const outstanding = bill ? bill.totalAmount - bill.amountPaid : 0;
  const rentalSubtotal = bill
    ? bill.subtotal - (bill.transportationCharges || 0) - (bill.damageCharges || 0)
    : 0;

  /** Save handler for bill status changes */
  const handleStatusSave = useCallback(
    async (newValue: string | number) => {
      await updateBillStatus({
        businessId: currentBusinessId!,
        billId: billId!,
        status: newValue as Bill['status'],
      }).unwrap();
    },
    [currentBusinessId, billId, updateBillStatus],
  );

  const handleRegenerate = useCallback(async () => {
    if (!bill || !currentBusinessId) return;
    setIsRegenerating(true);
    try {
      await deleteBill({
        businessId: currentBusinessId,
        billId: bill._id,
        force: true,
      }).unwrap();

      await generateBill({
        businessId: currentBusinessId,
        data: {
          billDate: bill.billDate || bill.billingPeriod.end || bill.createdAt,
          partyId: bill.partyId,
          agreementId: bill.agreementId,
          billingPeriod: bill.billingPeriod,
          taxMode: bill.taxMode,
          taxRate: bill.taxRate,
          sgstRate: bill.sgstRate,
          cgstRate: bill.cgstRate,
          igstRate: bill.igstRate,
          discountRate: bill.discountRate,
          notes: bill.notes,
        },
      }).unwrap();

      navigate('/bills', { replace: true });
    } catch {
      setIsRegenerating(false);
    }
  }, [bill, currentBusinessId, deleteBill, generateBill, navigate]);

  const handleSendEmail = useCallback(async () => {
    if (!bill || !currentBusinessId) return;
    try {
      await sendBillEmail({
        businessId: currentBusinessId,
        billId: bill._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [bill, currentBusinessId, sendBillEmail]);

  const handleDownloadPdf = useCallback(async () => {
    if (!bill || !currentBusinessId) return;
    try {
      const blob = await downloadPdf({
        businessId: currentBusinessId,
        billId: bill._id,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${bill.billNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [bill, currentBusinessId, downloadPdf]);

  const sidebar = bill ? (
    <DetailSection title="Details">
      <DetailField label="Bill Number" value={bill.billNumber} />

      {/* Editable: Status */}
      <DetailField
        label="Status"
        value={
          <span className={`status status-${bill.status}`}>
            {bill.status}
          </span>
        }
        editable={{
          rawValue: bill.status,
          inputType: 'select',
          options: BILL_STATUS_OPTIONS,
          onSave: handleStatusSave,
          isSaving,
        }}
      />

      <DetailField
        label="Party"
        value={
          <Link
            to={`/parties/${bill.partyId}`}
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
            to={`/agreements/${bill.agreementId}`}
            className="link-accent"
          >
            {bill.agreementId}
          </Link>
        }
      />
      <DetailField label="Due Date" value={formatDate(bill.dueDate)} />
      <DetailField label="Currency" value={bill.currency} />
      <DetailField label="Created" value={formatDate(bill.createdAt)} />
      <DetailField label="Updated" value={formatDate(bill.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={bill?.billNumber || 'Bill'}
      subtitle={partyName ? `Party: ${partyName}` : undefined}
      status={bill?.status}
      statusClassName={`status status-${bill?.status}`}
      backTo="/bills"
      backLabel="Bills"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
      headerActions={
        bill && currentBusinessId ? (
          <>
            {bill.status !== 'cancelled' && bill.status !== 'paid' && (
              <button
                className="btn btn-secondary"
                onClick={handleSendEmail}
                disabled={isSending}
              >
                {isSending ? 'Sending...' : 'Send Email'}
              </button>
            )}
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
              Download Invoice
            </button>
          </>
        ) : undefined
      }
    >
      {bill && (
        <>
          {/* Stale Warning Banner */}
          {bill.isStale && (
            <div className={pageStyles.staleBanner}>
              <span className={pageStyles.iconSize20}>&#9888;</span>
              <span className={pageStyles.flexGrow1}>
                <strong>Stale bill</strong> &mdash; Underlying challan data has changed since this bill was generated.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? 'Regenerating...' : 'Regenerate Bill'}
              </button>
            </div>
          )}

          {/* Billing Period */}
          <DetailSection title="Billing Period">
            <DetailField label="Period Start" value={formatDate(bill.billingPeriod.start)} />
            <DetailField label="Period End" value={formatDate(bill.billingPeriod.end)} />
            <DetailField
              label="Bill Date"
              value={formatDate(
                bill.billDate || bill.billingPeriod?.end || bill.createdAt
              )}
            />
          </DetailSection>

          {/* Line Items */}
          <DetailSection title={`Line Items (${bill.items.length})`}>
            {bill.items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate/Day</th>
                    <th>Days</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item, idx) => (
                    <tr key={`${item.itemId}-${idx}`}>
                      <td>{item.itemName}</td>
                      <td>{item.quantity}</td>
                      <td>₹{item.ratePerDay}</td>
                      <td>{item.totalDays}</td>
                      <td className="text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-empty">No line items.</p>
            )}
          </DetailSection>

          {/* Damage Items (if any) */}
          {bill.damageItems && bill.damageItems.length > 0 && (
            <DetailSection title={`Damage Items (${bill.damageItems.length})`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Challan</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th className="text-right">Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.damageItems.map((d, idx) => (
                    <tr key={`${d.itemId}-${idx}`}>
                      <td>{d.challanNumber || '-'}</td>
                      <td>{d.itemName}</td>
                      <td>{d.quantity}</td>
                      <td>₹{d.damageRate}</td>
                      <td className="text-right">{formatCurrency(d.amount)}</td>
                      <td className={d.note ? 'text-notes' : 'text-notes-empty'}>
                        {d.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DetailSection>
          )}

          {/* Transportation Breakup */}
          {bill.transportationBreakup && bill.transportationBreakup.length > 0 && (
            <DetailSection title="Transportation Breakup">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Challan No</th>
                    <th>Type</th>
                    <th className="text-right">Cartage</th>
                    <th className="text-right">Loading</th>
                    <th className="text-right">Unloading</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.transportationBreakup.map((t, idx) => (
                    <tr key={`${t.challanNumber}-${idx}`}>
                      <td>{t.challanNumber}</td>
                      <td>{t.challanType === 'delivery' ? 'Delivery' : 'Return'}</td>
                      <td className="text-right">{formatCurrency(t.cartageCharge)}</td>
                      <td className="text-right">{formatCurrency(t.loadingCharge)}</td>
                      <td className="text-right">{formatCurrency(t.unloadingCharge)}</td>
                      <td className="text-right">{formatCurrency(t.totalCharge)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}><strong>Total</strong></td>
                    <td className="text-right">
                      <strong>{formatCurrency(bill.transportationCharges || 0)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </DetailSection>
          )}

          {/* Financial Summary */}
          <DetailSection title="Financial Summary">
            <DetailField label="Rental Subtotal" value={formatCurrency(rentalSubtotal)} />
            <DetailField
              label="Transportation Charges"
              value={formatCurrency(bill.transportationCharges || 0)}
            />
            <DetailField
              label="Damage Charges"
              value={formatCurrency(bill.damageCharges || 0)}
            />
            <DetailField label="Subtotal" value={formatCurrency(bill.subtotal)} />
            {bill.taxMode === 'intra' ? (
              <>
                <DetailField
                  label="SGST"
                  value={`${formatCurrency(bill.sgstAmount || 0)} (${bill.sgstRate || 0}%)`}
                />
                <DetailField
                  label="CGST"
                  value={`${formatCurrency(bill.cgstAmount || 0)} (${bill.cgstRate || 0}%)`}
                />
              </>
            ) : bill.taxMode === 'inter' ? (
              <DetailField
                label="IGST"
                value={`${formatCurrency(bill.igstAmount || 0)} (${bill.igstRate || 0}%)`}
              />
            ) : (
              <DetailField
                label="Tax"
                value={`${formatCurrency(bill.taxAmount)} (${bill.taxRate || 0}%)`}
              />
            )}
            {(bill.taxMode === 'intra' || bill.taxMode === 'inter') && (
              <DetailField label="Total Tax" value={formatCurrency(bill.taxAmount)} />
            )}
            <DetailField
              label="Discount"
              value={`${formatCurrency(bill.discountAmount)} (${bill.discountRate}%)`}
            />
            <DetailField
              label="Total Amount"
              value={<strong>{formatCurrency(bill.totalAmount)}</strong>}
            />
            <DetailField label="Amount Paid" value={formatCurrency(bill.amountPaid)} />
            <DetailField
              label="Outstanding"
              value={
                <strong style={{ color: outstanding > 0 ? 'var(--status-danger-text)' : 'var(--status-success-text)' }}>
                  {formatCurrency(outstanding)}
                </strong>
              }
            />
          </DetailSection>

          {/* Payments */}
          <DetailSection title={`Payments (${(payments || []).length})`}>
            {(payments || []).length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(payments || [])]
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    )
                    .map((payment) => (
                      <tr key={payment._id}>
                        <td>
                          <Link
                            to={`/payments/${payment._id}`}
                            className="link-accent"
                          >
                            {formatDate(payment.date)}
                          </Link>
                        </td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.method.replace('_', ' ')}</td>
                        <td>
                          <span className={`status status-${payment.status}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td>{payment.reference || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-empty">
                No payments recorded for this bill.
              </p>
            )}
          </DetailSection>

          {/* Notes */}
          <DetailSection title="Notes">
            <p className={bill.notes ? 'text-notes' : 'text-notes-empty'}>
              {bill.notes || 'No notes.'}
            </p>
          </DetailSection>
        </>
      )}
    </DetailPageShell>
  );
}
