/**
 * Bills management page
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import {
  useGetBillsPageQuery,
  useGenerateBillMutation,
  useBulkGenerateBillsMutation,
} from '../api/billApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetAgreementsQuery } from '../api/agreementApi';
import { useBillGenerationProgress } from '../hooks/useBillGenerationProgress';
import {
  BulkActionBar,
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
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
import { BulkBillProgress } from '../components/BulkBillProgress';
import { getErrorMessage } from '../api/baseApi';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, GenerateBillInput, BulkGenerateBillInput } from '../types';
import { MessageDialog, useBulkSelection, useConfirm } from '../components/bulk';
import { useBillBulkActions } from './bills/useBillBulkActions';
import { useBillRowActions } from './bills/useBillRowActions';
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

  // Selection is per page of the server list: it clears on page, filter, search or business change.
  const selection = useBulkSelection({
    rows: bills,
    rowKey: bill => bill._id,
    resetKey: `${currentBusinessId}|${filtersKey}|${page}`,
    label: bill => `Select ${bill.billNumber}`,
  });
  const selectedBills = selection.selectedRows;

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: agreements } = useGetAgreementsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [generateBill, { isLoading: isGenerating }] = useGenerateBillMutation();
  const [bulkGenerateBills, { isLoading: isBulkGenerating }] = useBulkGenerateBillsMutation();
  const [failure, setFailure] = useState<string | null>(null);
  const confirm = useConfirm();
  const { rowActions, dialog: rowDialog } = useBillRowActions({
    businessId: currentBusinessId || '',
    ask: confirm.ask,
    onError: setFailure,
  });

  const { batches, startBatch, dismissBatch } = useBillGenerationProgress();

  const bulk = useBillBulkActions({
    businessId: currentBusinessId || '',
    bills: selectedBills,
    ask: confirm.ask,
    onSucceeded: selection.remove,
  });

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
      setFailure(getErrorMessage(err));
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
      setFailure(getErrorMessage(err));
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

      {selection.mobileSelectAll}

      <Card padded={false}>
        <DataTable
          aria-label="Bills"
          columns={columns}
          rows={bills}
          rowKey={bill => bill._id}
          selection={selection.selectionProp}
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

      <BulkActionBar
        count={selectedBills.length}
        noun={selectedBills.length === 1 ? 'bill' : 'bills'}
        onClear={selection.clear}
      >
        {bulk.actions}
      </BulkActionBar>

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

      {rowDialog}
      {confirm.dialog}
      {bulk.dialog}
      <MessageDialog
        title="Something went wrong"
        message={failure}
        onClose={() => setFailure(null)}
      />
    </div>
  );
}
