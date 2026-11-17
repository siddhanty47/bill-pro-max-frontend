/**
 * @fileoverview Bill detail view page
 * @description Detail page for a single bill: billing period, summary and notes,
 * line/damage/transportation tables, payments and change history. Header actions
 * (send email, mark paid, download PDF, status changes) and stale-bill
 * regeneration. Built on the kit's detail recipe.
 */
import { useCallback, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './BillDetailPage.module.css';
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
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  Notice,
  StatusChip,
  Table,
  TBody,
  Td,
  Tr,
  type Column,
} from '../components/ui';
import { getErrorMessage } from '../api/baseApi';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, BillItem, DamageBillItem, Payment, TransportationBreakupItem } from '../types';

/** Bill statuses a bill can be moved to from the header menu */
const BILL_STATUSES: { value: Bill['status']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METHOD_LABEL: Record<Payment['method'], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  other: 'Other',
};

/** Rows carry their list position so repeated items keep distinct keys. */
type ItemRow = BillItem & { idx: number };
type DamageRow = DamageBillItem & { idx: number };
type TransportRow = TransportationBreakupItem & { idx: number };

const notAdded = <span className="text-empty">Not added</span>;

/**
 * BillDetailPage displays the full details of a single bill/invoice.
 * Route: /bills/:billId
 */
export function BillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();

  const {
    data: bill,
    isLoading,
    error,
    refetch,
  } = useGetBillQuery(
    { businessId: currentBusinessId!, billId: billId! },
    { skip: !currentBusinessId || !billId }
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: payments } = useGetPaymentsByBillQuery(
    { businessId: currentBusinessId!, billId: billId! },
    { skip: !currentBusinessId || !billId }
  );

  const [updateBillStatus, { isLoading: isSaving }] = useUpdateBillStatusMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [generateBill] = useGenerateBillMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyGetBillPdfQuery();
  const [sendBillEmail, { isLoading: isSending }] = useSendBillEmailMutation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('about');

  const partyName = parties?.find(p => p._id === bill?.partyId)?.name || bill?.partyId || '';
  const outstanding = bill ? bill.totalAmount - bill.amountPaid : 0;
  const rentalSubtotal = bill
    ? bill.subtotal - (bill.transportationCharges || 0) - (bill.damageCharges || 0)
    : 0;

  const paymentList = [...(payments ?? [])].sort(
    (x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()
  );

  const tabs = bill
    ? [
        { id: 'about', label: 'About' },
        { id: 'line-items', label: 'Line items', count: bill.items.length },
        { id: 'payments', label: 'Payments', count: paymentList.length },
        { id: 'change-history', label: 'Change history' },
      ]
    : undefined;

  /** Move the bill to another status (same mutation the inline status edit used) */
  const handleStatusChange = useCallback(
    async (status: Bill['status']) => {
      try {
        await updateBillStatus({
          businessId: currentBusinessId!,
          billId: billId!,
          status,
        }).unwrap();
      } catch (err) {
        alert(getErrorMessage(err));
      }
    },
    [currentBusinessId, billId, updateBillStatus]
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

  // ─── Line items ───────────────────────────────────────────────────

  const itemColumns: Column<ItemRow>[] = [
    { key: 'itemName', header: 'Item' },
    { key: 'quantity', header: 'Qty', mono: true, align: 'right', nowrap: true },
    {
      key: 'rate',
      header: 'Rate/day',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => formatMoney(r.ratePerDay),
    },
    {
      key: 'days',
      header: 'Days',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => r.totalDays,
    },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => formatMoney(r.amount),
    },
  ];
  const itemRows: ItemRow[] = (bill?.items ?? []).map((item, idx) => ({ ...item, idx }));

  const damageColumns: Column<DamageRow>[] = [
    {
      key: 'challan',
      header: 'Challan',
      nowrap: true,
      render: d => (d.challanNumber ? <span className="mono">{d.challanNumber}</span> : notAdded),
    },
    { key: 'itemName', header: 'Item' },
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
      render: d => formatMoney(d.amount),
    },
    { key: 'note', header: 'Note', hideOnMobile: true, render: d => d.note || notAdded },
  ];
  const damageRows: DamageRow[] = (bill?.damageItems ?? []).map((d, idx) => ({ ...d, idx }));

  const money = (
    key: string,
    header: string,
    pick: (t: TransportRow) => number
  ): Column<TransportRow> => ({
    key,
    header,
    mono: true,
    align: 'right',
    nowrap: true,
    render: t => formatMoney(pick(t)),
  });
  const transportColumns: Column<TransportRow>[] = [
    { key: 'challanNumber', header: 'Challan', mono: true, nowrap: true },
    {
      key: 'type',
      header: 'Type',
      nowrap: true,
      render: t => (t.challanType === 'delivery' ? 'Delivery' : 'Return'),
    },
    money('cartage', 'Cartage', t => t.cartageCharge),
    money('loading', 'Loading', t => t.loadingCharge),
    money('unloading', 'Unloading', t => t.unloadingCharge),
    money('total', 'Total', t => t.totalCharge),
  ];
  const transportRows: TransportRow[] = (bill?.transportationBreakup ?? []).map((t, idx) => ({
    ...t,
    idx,
  }));

  // ─── Payments ─────────────────────────────────────────────────────

  const paymentDate = (p: Payment) => (
    <Link to={`/payments/${p._id}`} className="link-accent">
      {formatDate(p.date)}
    </Link>
  );
  const paymentColumns: Column<Payment>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: paymentDate },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: p => formatMoney(p.amount),
    },
    { key: 'method', header: 'Method', nowrap: true, render: p => METHOD_LABEL[p.method] },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: p => <StatusChip status={p.status} />,
    },
    {
      key: 'reference',
      header: 'Reference',
      hideOnMobile: true,
      render: p => (p.reference ? <span className="mono">{p.reference}</span> : notAdded),
    },
  ];

  // ─── Shell ────────────────────────────────────────────────────────

  const sidebar = bill ? (
    <DetailSection title="Details">
      <DetailField label="Bill number" value={bill.billNumber} mono />
      <DetailField
        label="Party"
        value={
          <Link to={`/parties/${bill.partyId}`} className="link-accent">
            {partyName}
          </Link>
        }
      />
      <DetailField
        label="Agreement"
        value={<DocNumber wrap value={bill.agreementId} to={`/agreements/${bill.agreementId}`} />}
      />
      <DetailField label="Due date" value={formatDate(bill.dueDate ?? '')} />
      <DetailField label="Currency" value={bill.currency} />
      <DetailField label="Created" value={formatDate(bill.createdAt ?? '')} />
      <DetailField label="Updated" value={formatDate(bill.updatedAt ?? '')} />
    </DetailSection>
  ) : null;

  const rate = (amount: number, pct: number | undefined) => `${formatMoney(amount)} (${pct || 0}%)`;
  const summaryRow = (label: string, value: string, strong = false) => (
    <Tr key={label}>
      <Td>{strong ? <strong>{label}</strong> : label}</Td>
      <Td align="right" mono nowrap>
        {strong ? <strong>{value}</strong> : value}
      </Td>
    </Tr>
  );

  const status = bill?.status;
  const canEmail = status !== undefined && status !== 'cancelled' && status !== 'paid';
  const primary: 'send' | 'paid' | 'download' =
    status === 'draft' ? 'send' : status === 'sent' || status === 'partial' ? 'paid' : 'download';
  const emailButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} onClick={handleSendEmail} loading={isSending}>
      Send email
    </Button>
  );
  const downloadButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} onClick={handleDownloadPdf} loading={isDownloading}>
      Download invoice
    </Button>
  );

  return (
    <DetailPageShell
      title={bill?.billNumber || 'Bill'}
      eyebrow="Bill"
      status={status}
      backTo="/bills"
      backLabel="Bills"
      isLoading={isLoading}
      loadingLabel="Loading bill…"
      error={error}
      onRetry={refetch}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="bill"
      sidebar={sidebar}
      headerActions={
        bill && currentBusinessId ? (
          <>
            {primary === 'send' && emailButton('primary')}
            {primary === 'paid' && (
              <Button
                variant="primary"
                onClick={() => handleStatusChange('paid')}
                loading={isSaving}
              >
                Mark paid
              </Button>
            )}
            {primary === 'download' ? downloadButton('primary') : downloadButton('secondary')}
            <Menu trigger={p => <IconButton label="More actions" icon="more" {...p} />}>
              {canEmail && primary !== 'send' && (
                <MenuItem onSelect={handleSendEmail}>Send email</MenuItem>
              )}
              <MenuLabel>Set status</MenuLabel>
              {BILL_STATUSES.filter(o => o.value !== bill.status).map(o => (
                <MenuItem key={o.value} onSelect={() => handleStatusChange(o.value)}>
                  {o.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : undefined
      }
    >
      {bill && (
        <>
          {bill.isStale && (
            <Notice tone="warning" title="Stale bill">
              <span className={styles.stale}>
                Underlying challan data has changed since this bill was generated.
                <Button variant="primary" onClick={handleRegenerate} loading={isRegenerating}>
                  Regenerate bill
                </Button>
              </span>
            </Notice>
          )}

          {activeTab === 'about' && (
            <>
              <DetailSection title="Billing period">
                <DetailField label="Period start" value={formatDate(bill.billingPeriod.start)} />
                <DetailField label="Period end" value={formatDate(bill.billingPeriod.end)} />
                <DetailField
                  label="Bill date"
                  value={formatDate(bill.billDate || bill.billingPeriod?.end || bill.createdAt)}
                />
              </DetailSection>

              <Card title="Summary" padded={false}>
                <Table aria-label="Summary">
                  <TBody>
                    {summaryRow('Rental subtotal', formatMoney(rentalSubtotal))}
                    {summaryRow('Transportation', formatMoney(bill.transportationCharges || 0))}
                    {summaryRow('Damage charges', formatMoney(bill.damageCharges || 0))}
                    {summaryRow('Subtotal', formatMoney(bill.subtotal))}
                    {bill.taxMode === 'intra' ? (
                      <>
                        {summaryRow('SGST', rate(bill.sgstAmount || 0, bill.sgstRate))}
                        {summaryRow('CGST', rate(bill.cgstAmount || 0, bill.cgstRate))}
                      </>
                    ) : bill.taxMode === 'inter' ? (
                      summaryRow('IGST', rate(bill.igstAmount || 0, bill.igstRate))
                    ) : (
                      summaryRow('Tax', rate(bill.taxAmount, bill.taxRate))
                    )}
                    {(bill.taxMode === 'intra' || bill.taxMode === 'inter') &&
                      summaryRow('Total tax', formatMoney(bill.taxAmount))}
                    {summaryRow('Discount', rate(bill.discountAmount, bill.discountRate))}
                    {summaryRow('Total', formatMoney(bill.totalAmount), true)}
                    {summaryRow('Paid', formatMoney(bill.amountPaid))}
                    {summaryRow('Balance due', formatMoney(outstanding), true)}
                  </TBody>
                </Table>
              </Card>

              <DetailSection title="Notes">
                <DetailField label="" value={bill.notes || undefined} />
              </DetailSection>
            </>
          )}

          {activeTab === 'line-items' && (
            <>
              <Card title="Line items" count={bill.items.length} padded={false}>
                <DataTable
                  aria-label="Line items"
                  columns={itemColumns}
                  rows={itemRows}
                  rowKey={r => `${r.itemId}-${r.idx}`}
                  empty={<EmptyState title="No line items" />}
                  mobile={{
                    title: r => r.itemName,
                    badge: r => <span className="mono">{formatMoney(r.amount)}</span>,
                    meta: r => [
                      <span key="qty" className="mono">
                        {r.quantity} × {formatMoney(r.ratePerDay)} × {r.totalDays}d
                      </span>,
                    ],
                  }}
                />
              </Card>

              {damageRows.length > 0 && (
                <Card title="Damage items" count={damageRows.length} padded={false}>
                  <DataTable
                    aria-label="Damage items"
                    columns={damageColumns}
                    rows={damageRows}
                    rowKey={r => `${r.itemId}-${r.idx}`}
                    mobile={{
                      title: r => r.itemName,
                      badge: r => <span className="mono">{formatMoney(r.amount)}</span>,
                      subtitle: r => r.challanNumber,
                      meta: r => [
                        <span key="qty" className="mono">
                          {r.quantity} × {formatMoney(r.damageRate)}
                        </span>,
                        r.note,
                      ],
                    }}
                  />
                </Card>
              )}

              {transportRows.length > 0 && (
                <Card title="Transportation breakup" padded={false}>
                  <DataTable
                    aria-label="Transportation breakup"
                    columns={transportColumns}
                    rows={transportRows}
                    rowKey={r => `${r.challanNumber}-${r.idx}`}
                    mobile={{
                      title: r => <DocNumber value={r.challanNumber} />,
                      badge: r => <span className="mono">{formatMoney(r.totalCharge)}</span>,
                      subtitle: r => (r.challanType === 'delivery' ? 'Delivery' : 'Return'),
                      meta: r => [
                        <span key="c">
                          Cartage <span className="mono">{formatMoney(r.cartageCharge)}</span>
                        </span>,
                        <span key="l">
                          Loading <span className="mono">{formatMoney(r.loadingCharge)}</span>
                        </span>,
                        <span key="u">
                          Unloading <span className="mono">{formatMoney(r.unloadingCharge)}</span>
                        </span>,
                      ],
                    }}
                  />
                  <p className={styles.total}>
                    <strong>Total</strong>
                    <strong className="mono">{formatMoney(bill.transportationCharges || 0)}</strong>
                  </p>
                </Card>
              )}
            </>
          )}

          {activeTab === 'payments' && (
            <Card title="Payments" count={paymentList.length} padded={false}>
              <DataTable
                aria-label="Payments"
                columns={paymentColumns}
                rows={paymentList}
                rowKey={p => p._id}
                empty={<EmptyState title="No payments recorded for this bill" />}
                mobile={{
                  title: paymentDate,
                  badge: p => <StatusChip status={p.status} />,
                  meta: p => [
                    <span key="a" className="mono">
                      {formatMoney(p.amount)}
                    </span>,
                    METHOD_LABEL[p.method],
                    p.reference,
                  ],
                }}
              />
            </Card>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="bill" documentId={billId!} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
