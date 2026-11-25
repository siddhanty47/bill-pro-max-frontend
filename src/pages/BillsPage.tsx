/**
 * Bills management page
 */
import { useState, useRef, type ReactNode } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import {
  useGetBillsPageQuery,
  useGenerateBillMutation,
  useBulkGenerateBillsMutation,
  useUpdateBillStatusMutation,
  useDeleteBillMutation,
  useSendBillEmailMutation,
  useLazyGetBillPdfQuery,
} from '../api/billApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetAgreementsQuery } from '../api/agreementApi';
import { useBillGenerationProgress } from '../hooks/useBillGenerationProgress';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
  RowActions,
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { BillForm } from '../components/forms/BillForm';
import { BulkBillForm } from '../components/forms/BulkBillForm';
import { isIssued } from '../utils/billStatus';
import { effectiveAmount } from '../utils/billMoney';
import { useBillIssueGate } from '../hooks/useBillIssueGate';
import { BulkBillProgress } from '../components/BulkBillProgress';
import { getErrorMessage } from '../api/baseApi';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, GenerateBillInput, BulkGenerateBillInput } from '../types';
import styles from './BillsPage.module.css';

export function BillsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Status filter and search run on the server; the table shows one page at a time.
  const search = useDebouncedValue(searchTerm.trim());
  const filtersKey = `${search}|${statusFilter}`;
  const [lastTotal, setLastTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useListPage(filtersKey, lastTotal);

  // The paged query's args minus `page`; also the source detail pages re-fetch from to step.
  const listArgs = {
    businessId: currentBusinessId || '',
    pageSize: LIST_PAGE_SIZE,
    search: search || undefined,
    status: statusFilter || undefined,
  };
  const {
    data: pageData,
    currentData,
    isLoading,
    error,
    refetch,
  } = useGetBillsPageQuery({ ...listArgs, page }, { skip: !currentBusinessId });
  if (pageData && pageData.total !== lastTotal) setLastTotal(pageData.total);
  const hasFilters = Boolean(search || statusFilter);
  const bills = pageData?.rows ?? [];

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: agreements } = useGetAgreementsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [generateBill, { isLoading: isGenerating }] = useGenerateBillMutation();
  const [bulkGenerateBills, { isLoading: isBulkGenerating }] = useBulkGenerateBillsMutation();
  const [updateBillStatus] = useUpdateBillStatusMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [sendBillEmail] = useSendBillEmailMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyGetBillPdfQuery();

  const gate = useBillIssueGate(currentBusinessId);

  const { batches, startBatch, dismissBatch } = useBillGenerationProgress();

  const handleGenerate = () => {
    setIsModalOpen(true);
  };

  const handleBulkGenerate = () => {
    setIsBulkModalOpen(true);
  };

  useHotkey('alt+n', () => {
    if (!isModalOpen && !isBulkModalOpen) handleGenerate();
  });
  useHotkey('/', () => searchRef.current?.focus());

  const handleSubmit = async (data: GenerateBillInput) => {
    try {
      const result = await generateBill({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      startBatch(result.batchId, result.jobCount);
      setIsModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleBulkSubmit = async (data: BulkGenerateBillInput) => {
    try {
      const result = await bulkGenerateBills({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      startBatch(result.batchId, result.jobCount);
      setIsBulkModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleStatusChange = async (bill: Bill, newStatus: Bill['status']) => {
    try {
      await updateBillStatus({
        businessId: currentBusinessId!,
        billId: bill._id,
        status: newStatus,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleSendEmail = async (bill: Bill) => {
    if (!currentBusinessId) return;
    await gate.attempt(bill, acknowledgeNegative =>
      sendBillEmail({
        businessId: currentBusinessId,
        billId: bill._id,
        acknowledgeNegative,
      }).unwrap()
    );
  };

  const handleDownloadPdf = async (bill: Bill) => {
    if (!currentBusinessId) return;
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
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill "${bill.billNumber}"?`)) return;

    try {
      await deleteBill({
        businessId: currentBusinessId!,
        billId: bill._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getPartyName = (partyId: string) => {
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  const billDateOf = (bill: Bill) => bill.billDate ?? bill.billingPeriod?.end ?? bill.createdAt;
  const periodOf = (bill: Bill) =>
    `${formatDate(bill.billingPeriod.start)} – ${formatDate(bill.billingPeriod.end)}`;

  /** Effective amount (total + issued notes); the original total under it when notes exist. */
  const amountCell = (bill: Bill) => {
    const effective = <span className="mono">{formatMoney(effectiveAmount(bill))}</span>;
    if (!bill.notesTotal) return effective;
    return (
      <span className={styles.amount}>
        {effective}
        <span className={styles.was}>
          was <span className="mono">{formatMoney(bill.totalAmount)}</span>
        </span>
      </span>
    );
  };

  const statusCell = (bill: Bill) => (
    <span className={styles.status}>
      <StatusChip status={bill.status} />
      {!isIssued(bill) && bill.drift != null && (
        <StatusChip
          status="out-of-date"
          tone="warning"
          title="The total has changed since this bill was made"
        >
          Out of date
        </StatusChip>
      )}
      {isIssued(bill) && bill.pendingAdjustment != null && (
        <StatusChip
          status="pending-adjustment"
          tone="info"
          title="A credit or debit note is pending"
        >
          Pending adj.
        </StatusChip>
      )}
    </span>
  );

  const rowActions = (bill: Bill) => {
    const removable = !isIssued(bill);
    let primary: ReactNode = null;
    if (bill.status === 'draft') {
      primary = (
        <Button size="sm" variant="primary" onClick={() => handleSendEmail(bill)}>
          Send
        </Button>
      );
    } else if (bill.status === 'sent' || bill.status === 'partial') {
      primary = (
        <Button size="sm" onClick={() => handleStatusChange(bill, 'paid')}>
          Mark paid
        </Button>
      );
    }
    return (
      <RowActions
        primary={primary}
        items={[
          {
            label: 'Download invoice PDF',
            onClick: () => handleDownloadPdf(bill),
            disabled: isDownloading,
          },
          ...(removable
            ? [{ label: 'Delete', onClick: () => handleDelete(bill), tone: 'danger' as const }]
            : []),
        ]}
      />
    );
  };

  const columns: Column<Bill>[] = [
    {
      key: 'billNumber',
      header: 'Bill',
      nowrap: true,
      render: bill => <DocNumber value={bill.billNumber} to={`/bills/${bill._id}`} />,
    },
    {
      key: 'billDate',
      header: 'Date',
      nowrap: true,
      render: bill => {
        const date = billDateOf(bill);
        return date ? formatDate(date) : '—';
      },
    },
    { key: 'partyId', header: 'Party', render: bill => getPartyName(bill.partyId) },
    { key: 'billingPeriod', header: 'Period', hideOnMobile: true, nowrap: true, render: periodOf },
    {
      key: 'totalAmount',
      header: 'Amount',
      align: 'right',
      render: amountCell,
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      mono: true,
      align: 'right',
      hideOnMobile: true,
      render: bill => formatMoney(bill.amountPaid),
    },
    { key: 'status', header: 'Status', nowrap: true, render: statusCell },
    { key: 'actions', header: 'Actions', align: 'right', nowrap: true, render: rowActions },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading bills…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader
        title="Bills"
        actions={
          <>
            <Button onClick={handleBulkGenerate}>Bulk generate</Button>
            <Button
              variant="primary"
              icon="plus"
              hint={shortcutLabel('N')}
              onClick={handleGenerate}
            >
              Generate bill
            </Button>
          </>
        }
      />

      <BulkBillProgress batches={batches} onDismiss={dismissBatch} />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search bills"
          hint="/"
          placeholder="Search bill no. or party"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </FilterBar>

      <Card padded={false}>
        <DataTable
          aria-label="Bills"
          columns={columns}
          rows={bills}
          rowKey={bill => bill._id}
          pagination={{
            page,
            pageSize: LIST_PAGE_SIZE,
            total: pageData?.total ?? 0,
            onPageChange: setPage,
            // Only while the rows match these args; stale rows get page-only context.
            navSource: currentData ? { list: 'bills', args: listArgs } : undefined,
          }}
          rowLink={bill => `/bills/${bill._id}`}
          empty={
            !hasFilters ? (
              <EmptyState
                title="No bills yet"
                action={
                  <Button variant="primary" icon="plus" onClick={handleGenerate}>
                    Generate bill
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No bills match these filters" />
            )
          }
          mobile={{
            title: bill => <DocNumber value={bill.billNumber} to={`/bills/${bill._id}`} />,
            badge: statusCell,
            subtitle: bill => getPartyName(bill.partyId),
            meta: bill => {
              const date = billDateOf(bill);
              return [
                date ? formatDate(date) : '',
                <span key="amount">{amountCell(bill)}</span>,
                <span key="paid">
                  Paid <span className="mono">{formatMoney(bill.amountPaid)}</span>
                </span>,
                periodOf(bill),
              ];
            },
            actions: rowActions,
          }}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate bill"
        size="form"
      >
        <BillForm
          parties={parties || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isGenerating}
        />
      </Modal>

      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk generate bills"
        size="form"
      >
        <BulkBillForm
          agreements={agreements || []}
          onSubmit={handleBulkSubmit}
          onCancel={() => setIsBulkModalOpen(false)}
          isLoading={isBulkGenerating}
        />
      </Modal>

      {gate.dialog}
    </div>
  );
}
