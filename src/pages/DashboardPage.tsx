/**
 * Dashboard: KPI tiles, charts, stock and party panels (dashboard/*), then overdue bills.
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetOverdueBillsQuery } from '../api/billApi';
import { useGetDashboardSummaryQuery } from '../api/dashboardApi';
import { useCreateBusinessMutation } from '../api/businessApi';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  Modal,
  PageHeader,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { BusinessForm } from '../components/forms/BusinessForm';
import { getErrorMessage } from '../api/baseApi';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, CreateBusinessInput } from '../types';
import { DashboardInsights } from './dashboard/DashboardInsights';
import styles from './DashboardPage.module.css';

const MAX_OVERDUE_ROWS = 5;

/** Calendar days past due (local midnight to local midnight), at least 1 for an overdue bill. */
function daysOverdue(bill: Bill): number {
  const due = new Date(bill.dueDate);
  const now = new Date();
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.round((today - dueDay) / 86_400_000));
}

function overdueLabel(bill: Bill): string {
  const days = daysOverdue(bill);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function DashboardPage() {
  const {
    currentBusinessId,
    currentBusiness,
    businesses,
    isLoading: businessLoading,
  } = useCurrentBusiness();
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);

  const [createBusiness, { isLoading: isCreating }] = useCreateBusinessMutation();

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useGetDashboardSummaryQuery(currentBusinessId || '', { skip: !currentBusinessId });

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: overdueBills } = useGetOverdueBillsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const handleCreateBusiness = async (data: CreateBusinessInput) => {
    try {
      await createBusiness(data).unwrap();
      setIsBusinessModalOpen(false);
      // Note: User may need to re-login to see new business in their token
      alert('Business created successfully! You may need to logout and login again to access it.');
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const businessModal = (
    <Modal
      isOpen={isBusinessModalOpen}
      onClose={() => setIsBusinessModalOpen(false)}
      title="Create new business"
      size="form"
    >
      <BusinessForm
        onSubmit={handleCreateBusiness}
        onCancel={() => setIsBusinessModalOpen(false)}
        isLoading={isCreating}
      />
    </Modal>
  );

  if (businessLoading || summaryLoading) {
    return <Spinner message="Loading dashboard…" />;
  }

  // Show create business prompt if no businesses exist
  if (!currentBusinessId && businesses.length === 0) {
    return (
      <div>
        <EmptyState
          title="No businesses yet"
          action={
            <Button variant="primary" icon="plus" onClick={() => setIsBusinessModalOpen(true)}>
              Create business
            </Button>
          }
        />
        {businessModal}
      </div>
    );
  }

  if (!currentBusinessId) {
    return <EmptyState title="Select a business from the menu above" />;
  }

  const partyNames = new Map((parties ?? []).map(p => [p._id, p.name]));
  const overdueRows = (overdueBills ?? []).slice(0, MAX_OVERDUE_ROWS);
  const showPartyColumn = overdueRows.some(b => partyNames.has(b.partyId));

  const columns: Column<Bill>[] = [
    {
      key: 'billNumber',
      header: 'Bill',
      render: b => <DocNumber value={b.billNumber} to={`/bills/${b._id}`} />,
    },
    ...(showPartyColumn
      ? [{ key: 'party', header: 'Party', render: (b: Bill) => partyNames.get(b.partyId) ?? '' }]
      : []),
    {
      key: 'dueDate',
      header: 'Due',
      nowrap: true,
      hideOnMobile: true,
      render: b => formatDate(b.dueDate),
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
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: b => <StatusChip status="overdue">{overdueLabel(b)}</StatusChip>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={currentBusiness?.name || 'Dashboard'}
        actions={
          <Button icon="plus" onClick={() => setIsBusinessModalOpen(true)}>
            Add business
          </Button>
        }
      />

      <div className={styles.page}>
        {summaryError ? (
          <ErrorMessage error={summaryError} onRetry={refetchSummary} />
        ) : (
          summary && <DashboardInsights businessId={currentBusinessId} summary={summary} />
        )}

        {overdueRows.length > 0 && (
          <Card
            padded={false}
            title="Overdue bills"
            count={overdueBills?.length}
            countTone="danger"
            actions={
              <Button variant="ghost" size="sm" to="/bills">
                All bills →
              </Button>
            }
          >
            <DataTable
              aria-label="Overdue bills"
              columns={columns}
              rows={overdueRows}
              rowKey={b => b._id}
              rowLink={b => `/bills/${b._id}`}
              mobile={{
                title: b => <DocNumber value={b.billNumber} to={`/bills/${b._id}`} />,
                badge: b => <StatusChip status="overdue">{overdueLabel(b)}</StatusChip>,
                subtitle: b => partyNames.get(b.partyId),
                meta: b => [
                  `Due ${formatDate(b.dueDate)}`,
                  <span key="amt" className="mono">
                    {formatMoney(b.totalAmount)}
                  </span>,
                ],
              }}
            />
          </Card>
        )}
      </div>

      {businessModal}
    </div>
  );
}
