/**
 * Payments list page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { shortcutLabel } from '../hooks/usePlatform';
import { useGetPaymentsQuery, useCreatePaymentMutation } from '../api/paymentApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetBillsQuery } from '../api/billApi';
import {
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
import type { Payment, CreatePaymentInput } from '../types';
import styles from './PaymentsPage.module.css';

const METHOD_LABELS: Record<Payment['method'], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  other: 'Other',
};

const typeLabel = (p: Payment) => (p.type === 'receivable' ? 'Received' : 'Paid');

export function PaymentsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
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

  const handleSubmit = async (data: CreatePaymentInput) => {
    try {
      await createPayment({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getPartyName = (partyId: string) => {
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  const filteredPayments = (payments || []).filter(payment => {
    const matchesSearch =
      !searchTerm ||
      getPartyName(payment.partyId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.reference && payment.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = !typeFilter || payment.type === typeFilter;
    const matchesMethod = !methodFilter || payment.method === methodFilter;
    return matchesSearch && matchesType && matchesMethod;
  });

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
          placeholder="Party or reference"
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

      <Card padded={false}>
        <DataTable
          aria-label="Payments"
          columns={columns}
          rows={filteredPayments}
          rowKey={p => p._id}
          onRowClick={p => navigate(`/payments/${p._id}`)}
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
    </div>
  );
}
