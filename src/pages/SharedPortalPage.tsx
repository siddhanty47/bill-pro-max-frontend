/**
 * @file SharedPortalPage
 * @description Public read-only portal for parties to view their challans,
 * running items, bills, and payment status via a shareable token-based URL.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from './SharedPortalPage.module.css';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DataTable } from '../components/DataTable';
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

type TabId = 'summary' | 'challans' | 'running-items' | 'bills' | 'payments';

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'challans', label: 'Challans' },
  { id: 'running-items', label: 'Running Items' },
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
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
    { skip: !token || activeTab !== 'challans' },
  );
  const { data: runningItemsResult } = useGetPortalRunningItemsQuery(token!, {
    skip: !token || activeTab !== 'running-items',
  });
  const { data: billsResult } = useGetPortalBillsQuery(
    { token: token!, page: billPage, pageSize: 20 },
    { skip: !token || activeTab !== 'bills' },
  );
  const { data: paymentsResult } = useGetPortalPaymentsQuery(
    { token: token!, page: paymentPage, pageSize: 20 },
    { skip: !token || activeTab !== 'payments' },
  );

  const summary = summaryResult?.data;
  const challans = challansResult?.data || [];
  const runningItems = runningItemsResult?.data || [];
  const bills = billsResult?.data || [];
  const payments = paymentsResult?.data || [];

  if (infoLoading) {
    return <LoadingSpinner message="Loading portal..." />;
  }

  if (infoError || !info) {
    const errData = infoError && 'data' in infoError
      ? (infoError.data as { error?: { code?: string; message?: string } })
      : null;
    const isExpired = errData?.error?.code === 'SHARE_LINK_EXPIRED';
    return (
      <div className={styles.portal}>
        <div className={`card ${styles.error}`}>
          <h2 className={styles.errorTitle}>
            {isExpired ? 'Link Expired' : 'Invalid Link'}
          </h2>
          <p className="text-empty">
            {isExpired
              ? 'This share link has expired. Please contact the business for a new link.'
              : 'This share link is invalid or has been revoked.'}
          </p>
        </div>
      </div>
    );
  }

  const challanColumns = [
    { key: 'challanNumber', header: 'Challan #' },
    {
      key: 'type',
      header: 'Type',
      render: (item: Record<string, unknown>) => (
        <span className={`status status-${item.type as string}`}>
          {item.type as string}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: Record<string, unknown>) => formatDate(item.date as string),
    },
    {
      key: 'items',
      header: 'Items',
      render: (item: Record<string, unknown>) => {
        const items = item.items as { itemName: string; quantity: number }[];
        return (
          <span className={styles.itemList}>
            {items.map((i) => `${i.itemName} x${i.quantity}`).join(', ')}
          </span>
        );
      },
    },
    {
      key: 'download',
      header: 'Download',
      render: (item: Record<string, unknown>) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => handleDownloadChallanPdf(item._id as string, item.challanNumber as string)}
        >
          PDF
        </button>
      ),
    },
  ];

  const billColumns = [
    { key: 'billNumber', header: 'Bill #' },
    {
      key: 'billingPeriod',
      header: 'Period',
      render: (item: Record<string, unknown>) => {
        const period = item.billingPeriod as { start: string; end: string } | null;
        return period ? `${formatDate(period.start)} - ${formatDate(period.end)}` : '-';
      },
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item: Record<string, unknown>) => formatCurrency(item.totalAmount as number),
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      render: (item: Record<string, unknown>) => formatCurrency(item.amountPaid as number),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (item: Record<string, unknown>) => formatDate(item.dueDate as string),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Record<string, unknown>) => (
        <span className={`status status-${item.status as string}`}>
          {item.status as string}
        </span>
      ),
    },
    {
      key: 'download',
      header: 'Download',
      render: (item: Record<string, unknown>) => (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => handleDownloadBillPdf(item._id as string, item.billNumber as string)}
        >
          PDF
        </button>
      ),
    },
  ];

  const runningItemColumns = [
    { key: 'itemName', header: 'Item' },
    { key: 'quantity', header: 'Quantity' },
  ];

  const itemsBreakdownColumns = [
    { key: 'itemName', header: 'Item' },
    { key: 'quantity', header: 'Quantity' },
  ];

  const METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    upi: 'UPI',
    cheque: 'Cheque',
    other: 'Other',
  };

  const paymentColumns = [
    {
      key: 'date',
      header: 'Date',
      render: (item: Record<string, unknown>) => formatDate(item.date as string),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: Record<string, unknown>) => formatCurrency(item.amount as number),
    },
    {
      key: 'method',
      header: 'Method',
      render: (item: Record<string, unknown>) =>
        METHOD_LABELS[item.method as string] || (item.method as string),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Record<string, unknown>) => (
        <span className={`status status-${item.status as string}`}>
          {item.status as string}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (item: Record<string, unknown>) =>
        (item.reference as string) || '-',
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (item: Record<string, unknown>) =>
        (item.notes as string) || '-',
    },
  ];

  return (
    <div className={styles.portal}>
      <header className={styles.header}>
        <p className={styles.businessName}>{info.businessName}</p>
        <h1 className={styles.partyName}>{info.partyName}</h1>
        {info.siteCode && (
          <p className={styles.scope}>
            Site: {info.siteName || info.siteCode}
          </p>
        )}
      </header>

      <nav className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'summary' && summary && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Outstanding</h3>
              <div className="value">{formatCurrency(summary.totalOutstanding)}</div>
            </div>
            <div className="stat-card">
              <h3>Items in use</h3>
              <div className="value">{summary.totalItemsInUse}</div>
            </div>
            <div className="stat-card">
              <h3>Total billed</h3>
              <div className="value">{formatCurrency(summary.totalBilled)}</div>
            </div>
            <div className="stat-card">
              <h3>Total paid</h3>
              <div className="value">{formatCurrency(summary.totalPaid)}</div>
            </div>
            <div className="stat-card">
              <h3>Bills</h3>
              <div className="value">{summary.billCount}</div>
            </div>
            <div className="stat-card">
              <h3>Overdue</h3>
              <div className="value">{summary.overdueBills}</div>
            </div>
          </div>

          {summary.itemsBreakdown.length > 0 && (
            <>
              <h3 className={styles.sectionTitle}>Items currently in use</h3>
              <DataTable
                data={summary.itemsBreakdown as unknown as Record<string, unknown>[]}
                columns={itemsBreakdownColumns}
                keyField="itemName"
                emptyMessage="No items in use"
              />
            </>
          )}
        </>
      )}

      {activeTab === 'challans' && (
        <>
          <DataTable
            data={challans as unknown as Record<string, unknown>[]}
            columns={challanColumns}
            keyField="challanNumber"
            emptyMessage="No challans found."
          />
          {challansResult?.pagination && challansResult.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              {challanPage > 1 && (
                <button className="btn btn-sm btn-secondary" onClick={() => setChallanPage((p) => p - 1)}>
                  Prev
                </button>
              )}
              <span>Page {challanPage} of {challansResult.pagination.totalPages}</span>
              {challansResult.pagination.hasNext && (
                <button className="btn btn-sm btn-secondary" onClick={() => setChallanPage((p) => p + 1)}>
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'running-items' && (
        <DataTable
          data={runningItems as unknown as Record<string, unknown>[]}
          columns={runningItemColumns}
          keyField="itemName"
          emptyMessage="No items currently in use."
        />
      )}

      {activeTab === 'bills' && (
        <>
          <DataTable
            data={bills as unknown as Record<string, unknown>[]}
            columns={billColumns}
            keyField="billNumber"
            emptyMessage="No bills found."
          />
          {billsResult?.pagination && billsResult.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              {billPage > 1 && (
                <button className="btn btn-sm btn-secondary" onClick={() => setBillPage((p) => p - 1)}>
                  Prev
                </button>
              )}
              <span>Page {billPage} of {billsResult.pagination.totalPages}</span>
              {billsResult.pagination.hasNext && (
                <button className="btn btn-sm btn-secondary" onClick={() => setBillPage((p) => p + 1)}>
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'payments' && (
        <>
          <DataTable
            data={payments as unknown as Record<string, unknown>[]}
            columns={paymentColumns}
            keyField="_id"
            emptyMessage="No payments found."
          />
          {paymentsResult?.pagination && paymentsResult.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              {paymentPage > 1 && (
                <button className="btn btn-sm btn-secondary" onClick={() => setPaymentPage((p) => p - 1)}>
                  Prev
                </button>
              )}
              <span>Page {paymentPage} of {paymentsResult.pagination.totalPages}</span>
              {paymentsResult.pagination.hasNext && (
                <button className="btn btn-sm btn-secondary" onClick={() => setPaymentPage((p) => p + 1)}>
                  Next
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
