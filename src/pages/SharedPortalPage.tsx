/**
 * @file SharedPortalPage
 * @description Public read-only portal for parties to view their challans,
 * running items, bills, and payment status via a shareable token-based URL.
 * Works signed-out: every call is keyed by the share token.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from './SharedPortalPage.module.css';
import {
  Brand,
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  Notice,
  PageHeader,
  StatCard,
  StatusChip,
  TabPanel,
  Tabs,
  Spinner,
  type Column,
} from '../components/ui';
import { NotAdded } from '../components/DetailPageShell';
import { formatDate, formatMoney } from '../utils/format';
import {
  useGetPortalInfoQuery,
  useGetPortalSummaryQuery,
  useGetPortalChallansQuery,
  useGetPortalRunningItemsQuery,
  useGetPortalBillsQuery,
  useGetPortalPaymentsQuery,
  useLazyGetPortalChallanPdfQuery,
  useLazyGetPortalBillPdfQuery,
} from '../api/shareLinkApi';
import type { PortalBill, PortalChallan, PortalPayment, PortalRunningItem } from '../types';

type TabId = 'summary' | 'challans' | 'running-items' | 'bills' | 'payments';

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'challans', label: 'Challans' },
  { id: 'running-items', label: 'Running items' },
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments' },
];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  other: 'Other',
};

const notAdded = <NotAdded />;

const itemsText = (c: PortalChallan) => c.items.map(i => `${i.itemName} x${i.quantity}`).join(', ');
const periodText = (b: PortalBill) =>
  b.billingPeriod
    ? `${formatDate(b.billingPeriod.start)} - ${formatDate(b.billingPeriod.end)}`
    : '';
const dueText = (b: PortalBill) => (b.dueDate ? `Due ${formatDate(b.dueDate)}` : '');

type PagerProps = {
  page: number;
  totalPages: number;
  hasNext: boolean;
  onPage: (page: number) => void;
};

function Pager({ page, totalPages, hasNext, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      {page > 1 && (
        <Button size="sm" onClick={() => onPage(page - 1)}>
          Prev
        </Button>
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {hasNext && (
        <Button size="sm" onClick={() => onPage(page + 1)}>
          Next
        </Button>
      )}
    </div>
  );
}

export function SharedPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [challanPage, setChallanPage] = useState(1);
  const [billPage, setBillPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  const [triggerChallanPdf] = useLazyGetPortalChallanPdfQuery();
  const [triggerBillPdf] = useLazyGetPortalBillPdfQuery();

  const handleDownloadChallanPdf = async (challanId: string, challanNumber: string) => {
    try {
      const blob = await triggerChallanPdf({ token: token!, challanId }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challan-${challanNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user sees no PDF
    }
  };

  const handleDownloadBillPdf = async (billId: string, billNumber: string) => {
    try {
      const blob = await triggerBillPdf({ token: token!, billId }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${billNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  const {
    data: infoResult,
    isLoading: infoLoading,
    error: infoError,
  } = useGetPortalInfoQuery(token!, { skip: !token });

  const info = infoResult?.data;

  const { data: summaryResult } = useGetPortalSummaryQuery(token!, {
    skip: !token || activeTab !== 'summary',
  });
  const { data: challansResult } = useGetPortalChallansQuery(
    { token: token!, page: challanPage, pageSize: 20 },
    { skip: !token || activeTab !== 'challans' }
  );
  const { data: runningItemsResult } = useGetPortalRunningItemsQuery(token!, {
    skip: !token || activeTab !== 'running-items',
  });
  const { data: billsResult } = useGetPortalBillsQuery(
    { token: token!, page: billPage, pageSize: 20 },
    { skip: !token || activeTab !== 'bills' }
  );
  const { data: paymentsResult } = useGetPortalPaymentsQuery(
    { token: token!, page: paymentPage, pageSize: 20 },
    { skip: !token || activeTab !== 'payments' }
  );

  const summary = summaryResult?.data;
  const challans = challansResult?.data || [];
  const runningItems = runningItemsResult?.data || [];
  const bills = billsResult?.data || [];
  const payments = paymentsResult?.data || [];

  if (infoLoading) {
    return <Spinner message="Loading portal…" />;
  }

  if (infoError || !info) {
    const errData =
      infoError && 'data' in infoError
        ? (infoError.data as { error?: { code?: string; message?: string } })
        : null;
    const isExpired = errData?.error?.code === 'SHARE_LINK_EXPIRED';
    return (
      <div className={styles.portal}>
        <div className={styles.brandBar}>
          <Brand />
        </div>
        <div className={styles.error}>
          <Notice
            tone={isExpired ? 'warning' : 'danger'}
            title={isExpired ? 'Link expired' : 'Invalid link'}
          >
            {isExpired
              ? 'This share link has expired. Ask the business for a new link.'
              : 'This share link is invalid or has been revoked.'}
          </Notice>
        </div>
      </div>
    );
  }

  const pdfAction = (label: string, onClick: () => void) => (
    <Button size="sm" variant="primary" aria-label={label} onClick={onClick}>
      PDF
    </Button>
  );

  const challanColumns: Column<PortalChallan>[] = [
    {
      key: 'challanNumber',
      header: 'Challan #',
      nowrap: true,
      render: c => <DocNumber value={c.challanNumber} />,
    },
    {
      key: 'type',
      header: 'Type',
      nowrap: true,
      render: c => <StatusChip status={c.type} />,
    },
    { key: 'date', header: 'Date', nowrap: true, render: c => formatDate(c.date) },
    {
      key: 'items',
      header: 'Items',
      render: c => <span className={styles.itemList}>{itemsText(c)}</span>,
    },
    {
      key: 'download',
      header: 'Download',
      nowrap: true,
      render: c =>
        pdfAction(`Download challan ${c.challanNumber} PDF`, () =>
          handleDownloadChallanPdf(c._id, c.challanNumber)
        ),
    },
  ];

  const billColumns: Column<PortalBill>[] = [
    {
      key: 'billNumber',
      header: 'Bill #',
      nowrap: true,
      render: b => <DocNumber value={b.billNumber} />,
    },
    {
      key: 'billingPeriod',
      header: 'Period',
      nowrap: true,
      render: b => periodText(b) || notAdded,
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: b => formatMoney(b.totalAmount),
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      mono: true,
      align: 'right',
      nowrap: true,
      render: b => formatMoney(b.amountPaid),
    },
    {
      key: 'dueDate',
      header: 'Due date',
      nowrap: true,
      render: b => (b.dueDate ? formatDate(b.dueDate) : notAdded),
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: b => <StatusChip status={b.status} />,
    },
    {
      key: 'download',
      header: 'Download',
      nowrap: true,
      render: b =>
        pdfAction(`Download bill ${b.billNumber} PDF`, () =>
          handleDownloadBillPdf(b._id, b.billNumber)
        ),
    },
  ];

  const itemColumns: Column<PortalRunningItem>[] = [
    { key: 'itemName', header: 'Item' },
    { key: 'quantity', header: 'Quantity', mono: true, align: 'right', nowrap: true },
  ];

  const paymentColumns: Column<PortalPayment>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: p => formatDate(p.date) },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: p => formatMoney(p.amount),
    },
    {
      key: 'method',
      header: 'Method',
      nowrap: true,
      render: p => METHOD_LABELS[p.method] ?? p.method,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: p => <StatusChip status={p.status} />,
    },
    {
      key: 'reference',
      header: 'Reference',
      mono: true,
      render: p => p.reference || notAdded,
    },
    { key: 'notes', header: 'Notes', render: p => p.notes || notAdded },
  ];

  const itemsMobile = {
    title: (i: PortalRunningItem) => i.itemName,
    badge: (i: PortalRunningItem) => <span className="mono">{i.quantity}</span>,
  };

  return (
    <div className={styles.portal}>
      <div className={styles.brandBar}>
        <Brand />
      </div>
      <PageHeader
        title={info.partyName}
        eyebrow={
          <>
            <span>{info.businessName}</span>
            {info.siteCode && <span> · Site: {info.siteName || info.siteCode}</span>}
          </>
        }
      />

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as TabId)}
        idPrefix="portal"
      />

      <TabPanel idPrefix="portal" tabId={activeTab} className={styles.panel}>
        {activeTab === 'summary' && summary && (
          <>
            <div className={styles.stats}>
              <StatCard
                label="Outstanding"
                value={formatMoney(summary.totalOutstanding)}
                tone="highlight"
              />
              <StatCard label="Items in use" value={summary.totalItemsInUse} />
              <StatCard label="Total billed" value={formatMoney(summary.totalBilled)} />
              <StatCard label="Total paid" value={formatMoney(summary.totalPaid)} />
              <StatCard label="Bills" value={summary.billCount} />
              <StatCard label="Overdue" value={summary.overdueBills} />
            </div>
            {summary.itemsBreakdown.length > 0 && (
              <Card title="Items currently in use" padded={false}>
                <DataTable
                  aria-label="Items currently in use"
                  columns={itemColumns}
                  rows={summary.itemsBreakdown}
                  rowKey={i => i.itemName}
                  mobile={itemsMobile}
                />
              </Card>
            )}
          </>
        )}

        {activeTab === 'challans' && (
          <>
            <DataTable
              aria-label="Challans"
              columns={challanColumns}
              rows={challans}
              rowKey={c => c._id}
              empty={<EmptyState title="No challans found." />}
              mobile={{
                title: c => <DocNumber value={c.challanNumber} />,
                badge: c => <StatusChip status={c.type} />,
                subtitle: c => itemsText(c),
                meta: c => [formatDate(c.date)],
                actions: c =>
                  pdfAction(`Download challan ${c.challanNumber} PDF`, () =>
                    handleDownloadChallanPdf(c._id, c.challanNumber)
                  ),
              }}
            />
            {challansResult?.pagination && (
              <Pager
                page={challanPage}
                totalPages={challansResult.pagination.totalPages}
                hasNext={challansResult.pagination.hasNext}
                onPage={setChallanPage}
              />
            )}
          </>
        )}

        {activeTab === 'running-items' && (
          <DataTable
            aria-label="Running items"
            columns={itemColumns}
            rows={runningItems}
            rowKey={i => i.itemName}
            empty={<EmptyState title="No items currently in use." />}
            mobile={itemsMobile}
          />
        )}

        {activeTab === 'bills' && (
          <>
            <DataTable
              aria-label="Bills"
              columns={billColumns}
              rows={bills}
              rowKey={b => b._id}
              empty={<EmptyState title="No bills found." />}
              mobile={{
                title: b => <DocNumber value={b.billNumber} />,
                badge: b => <StatusChip status={b.status} />,
                subtitle: b => <span className="mono">{formatMoney(b.totalAmount)}</span>,
                meta: b => [
                  periodText(b),
                  <span key="paid" className="mono">
                    Paid {formatMoney(b.amountPaid)}
                  </span>,
                  dueText(b),
                ],
                actions: b =>
                  pdfAction(`Download bill ${b.billNumber} PDF`, () =>
                    handleDownloadBillPdf(b._id, b.billNumber)
                  ),
              }}
            />
            {billsResult?.pagination && (
              <Pager
                page={billPage}
                totalPages={billsResult.pagination.totalPages}
                hasNext={billsResult.pagination.hasNext}
                onPage={setBillPage}
              />
            )}
          </>
        )}

        {activeTab === 'payments' && (
          <>
            <DataTable
              aria-label="Payments"
              columns={paymentColumns}
              rows={payments}
              rowKey={p => p._id}
              empty={<EmptyState title="No payments found." />}
              mobile={{
                title: p => <span className="mono">{formatMoney(p.amount)}</span>,
                badge: p => <StatusChip status={p.status} />,
                subtitle: p => METHOD_LABELS[p.method] ?? p.method,
                meta: p => [
                  formatDate(p.date),
                  p.reference ? (
                    <span key="ref" className="mono">
                      {p.reference}
                    </span>
                  ) : (
                    ''
                  ),
                  p.notes ?? '',
                ],
              }}
            />
            {paymentsResult?.pagination && (
              <Pager
                page={paymentPage}
                totalPages={paymentsResult.pagination.totalPages}
                hasNext={paymentsResult.pagination.hasNext}
                onPage={setPaymentPage}
              />
            )}
          </>
        )}
      </TabPanel>
    </div>
  );
}
