/**
 * Payments list page. Selected rows (on the visible page) export to CSV; there is no bulk
 * delete because the backend has no payment delete.
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import { useGetPaymentsQuery, useCreatePaymentMutation } from '../api/paymentApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetBillsQuery } from '../api/billApi';
import {
  BulkActionBar,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  StatCard,
  StatusChip,
  type Column,
} from '../components/ui';
import { signTone } from '../components/ui/status';
import { PaymentForm } from '../components/forms/PaymentForm';
import { getErrorMessage } from '../api/baseApi';
import { formatDate, formatMoney } from '../utils/format';
import { csvFileName, downloadCsv } from '../utils/csv';
import { METHOD_LABELS, paymentsCsv, typeLabel } from './payments/paymentsCsv';
import { ExportCsvButton, MessageDialog, useBulkSelection } from '../components/bulk';
import type { Payment, CreatePaymentInput } from '../types';
import styles from './PaymentsPage.module.css';
import { useBillIssueGate } from '../hooks/useBillIssueGate';
import { matchesSearch } from '../utils/search';

export function PaymentsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: payments,
    isLoading,
    error,
    refetch,
  } = useGetPaymentsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: bills } = useGetBillsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createPayment, { isLoading: isCreating }] = useCreatePaymentMutation();

  const handleCreate = () => {
    setIsModalOpen(true);
  };

  useHotkey('alt+n', () => {
    if (!isModalOpen) handleCreate();
  });
  useHotkey('/', () => searchRef.current?.focus());

  // Paying a draft bill sends it: the same out-of-date and negative-stock checks as sending
  const issueGate = useBillIssueGate(currentBusinessId, { onError: setFailure });

  const handleSubmit = async (data: CreatePaymentInput) => {
    const bill = data.billId ? bills?.find(b => b._id === data.billId) : undefined;
    if (bill?.status === 'draft') {
      await issueGate.attempt(
        bill,
        async acknowledgeNegative => {
          await createPayment({
            businessId: currentBusinessId!,
            data: acknowledgeNegative ? { ...data, acknowledgeNegative } : data,
          }).unwrap();
          setIsModalOpen(false);
        },
        true,
        'pay'
      );
      return;
    }
    try {
      await createPayment({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsModalOpen(false);
    } catch (err) {
      setFailure(getErrorMessage(err));
    }
  };

  const getPartyName = (partyId: string) => {
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  const filteredPayments = (payments || []).filter(payment => {
    const party = parties?.find(p => p._id === payment.partyId);
    const matchesText = matchesSearch(searchTerm, [party?.name, party?.code, payment.reference]);
    const matchesType = !typeFilter || payment.type === typeFilter;
    const matchesMethod = !methodFilter || payment.method === methodFilter;
    return matchesText && matchesType && matchesMethod;
  });

  // The table pages the whole list (so Prev/Next covers every payment) on a page held here,
  // so the selection only ever covers the payments on screen. It clears on page, filter,
  // search or business change.
  const filtersKey = `${currentBusinessId}|${searchTerm}|${typeFilter}|${methodFilter}`;
  const [page, setPage] = useListPage(filtersKey, filteredPayments.length);
  const pageRows = filteredPayments.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);
  const selection = useBulkSelection({
    rows: pageRows,
    rowKey: p => p._id,
    resetKey: `${filtersKey}|${page}`,
    label: p => `Select payment of ${formatMoney(p.amount)} on ${formatDate(p.date)}`,
  });
  const selectedPayments = selection.selectedRows;
  const exportSelected = () =>
    downloadCsv(csvFileName('payments'), paymentsCsv(selectedPayments, getPartyName));

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: p => formatDate(p.date) },
    { key: 'type', header: 'Type', nowrap: true, hideOnMobile: true, render: typeLabel },
    { key: 'partyId', header: 'Party', render: p => getPartyName(p.partyId) },
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
      hideOnMobile: true,
      nowrap: true,
      render: p => METHOD_LABELS[p.method] ?? p.method,
    },
    {
      key: 'reference',
      header: 'Reference',
      mono: true,
      nowrap: true,
      hideOnMobile: true,
      render: p => p.reference || '—',
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: p => <StatusChip status={p.status} />,
    },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading payments…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  const totalReceived = (payments || [])
    .filter(p => p.type === 'receivable' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = (payments || [])
    .filter(p => p.type === 'payable' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        actions={
          <Button variant="primary" icon="plus" hint={shortcutLabel('N')} onClick={handleCreate}>
            Record payment
          </Button>
        }
      />

      <div className={styles.summaryGrid}>
        <StatCard label="Total received" value={formatMoney(totalReceived)} valueTone="positive" />
        <StatCard label="Total paid" value={formatMoney(totalPaid)} valueTone="negative" />
        <StatCard
          label="Net"
          value={formatMoney(totalReceived - totalPaid)}
          valueTone={signTone(totalReceived - totalPaid)}
        />
      </div>

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search payments"
          hint="/"
          placeholder="Party, party code or reference"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select aria-label="Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="receivable">Received</option>
          <option value="payable">Paid</option>
        </Select>
        <Select
          aria-label="Method"
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
        >
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </Select>
      </FilterBar>

      {selection.mobileSelectAll}

      <Card padded={false}>
        <DataTable
          aria-label="Payments"
          columns={columns}
          rows={filteredPayments}
          rowKey={p => p._id}
          rowLink={p => `/payments/${p._id}`}
          selection={selection.selectionProp}
          page={page}
          onPageChange={setPage}
          empty={
            (payments || []).length === 0 ? (
              <EmptyState
                title="No payments yet"
                action={
                  <Button variant="primary" icon="plus" onClick={handleCreate}>
                    Record payment
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No payments match these filters" />
            )
          }
          mobile={{
            title: p => <span className="mono">{formatMoney(p.amount)}</span>,
            badge: p => <StatusChip status={p.status} />,
            subtitle: p => getPartyName(p.partyId),
            meta: p => [
              typeLabel(p),
              formatDate(p.date),
              METHOD_LABELS[p.method] ?? p.method,
              p.reference ? (
                <span key="reference" className="mono">
                  {p.reference}
                </span>
              ) : (
                ''
              ),
            ],
          }}
        />
      </Card>

      <BulkActionBar
        count={selectedPayments.length}
        noun={selectedPayments.length === 1 ? 'payment' : 'payments'}
        onClear={selection.clear}
      >
        <ExportCsvButton count={selectedPayments.length} onExport={exportSelected} />
      </BulkActionBar>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record payment"
        size="form"
      >
        <PaymentForm
          parties={parties || []}
          bills={bills || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>

      {issueGate.dialog}

      <MessageDialog
        title="Couldn't record payment"
        message={failure}
        onClose={() => setFailure(null)}
      />
    </div>
  );
}
