/**
 * Bills management page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import {
  useGetBillsQuery,
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
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { BillForm } from '../components/forms/BillForm';
import { BulkBillForm } from '../components/forms/BulkBillForm';
import { BulkBillProgress } from '../components/BulkBillProgress';
import { getErrorMessage } from '../api/baseApi';
import { formatDate, formatMoney } from '../utils/format';
import type { Bill, GenerateBillInput, BulkGenerateBillInput } from '../types';
import styles from './BillsPage.module.css';

export function BillsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { modLabel } = usePlatform();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: bills,
    isLoading,
    error,
    refetch,
  } = useGetBillsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

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
    try {
      await sendBillEmail({
        businessId: currentBusinessId,
        billId: bill._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
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
    const isDraftOrCancelled = bill.status === 'draft' || bill.status === 'cancelled';
    const message = isDraftOrCancelled
      ? `Delete bill "${bill.billNumber}"?`
      : `Bill "${bill.billNumber}" has status "${bill.status}". Force delete anyway? This cannot be undone.`;

    if (!confirm(message)) return;

    try {
      await deleteBill({
        businessId: currentBusinessId!,
        billId: bill._id,
        force: !isDraftOrCancelled,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getPartyName = (partyId: string) => {
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  const filteredBills = (bills || []).filter(bill => {
    const matchesSearch =
      !searchTerm ||
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPartyName(bill.partyId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const billDateOf = (bill: Bill) => bill.billDate ?? bill.billingPeriod?.end ?? bill.createdAt;
  const periodOf = (bill: Bill) =>
    `${formatDate(bill.billingPeriod.start)} – ${formatDate(bill.billingPeriod.end)}`;

  const statusCell = (bill: Bill) => (
    <span className={styles.status}>
      <StatusChip status={bill.status} />
      {bill.isStale && (
        <span title="Stale — underlying challan data changed">
          <StatusChip status="stale" tone="warning">
            Stale
          </StatusChip>
        </span>
      )}
    </span>
  );

  const actionButtons = (bill: Bill) => (
    <>
      <Button
        size="sm"
        title="Download invoice PDF"
        disabled={isDownloading}
        onClick={() => handleDownloadPdf(bill)}
      >
        Download
      </Button>
      {bill.status === 'draft' && (
        <Button size="sm" variant="primary" onClick={() => handleSendEmail(bill)}>
          Send
        </Button>
      )}
      {(bill.status === 'sent' || bill.status === 'partial') && (
        <Button size="sm" onClick={() => handleStatusChange(bill, 'paid')}>
          Mark paid
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        onClick={() => handleDelete(bill)}
        title={
          bill.status === 'draft' || bill.status === 'cancelled'
            ? 'Delete bill'
            : 'Force delete (bill has payments/status)'
        }
      >
        Delete
      </Button>
    </>
  );

  const columns: Column<Bill>[] = [
    {
      key: 'billNumber',
      header: 'Bill',
      render: bill => <DocNumber value={bill.billNumber} to={`/bills/${bill._id}`} />,
    },
    {
      key: 'billDate',
      header: 'Date',
      render: bill => {
        const date = billDateOf(bill);
        return date ? formatDate(date) : '—';
      },
    },
    { key: 'partyId', header: 'Party', render: bill => getPartyName(bill.partyId) },
    { key: 'billingPeriod', header: 'Period', hideOnMobile: true, render: periodOf },
    {
      key: 'totalAmount',
      header: 'Amount',
      mono: true,
      align: 'right',
      render: bill => formatMoney(bill.totalAmount),
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      mono: true,
      align: 'right',
      hideOnMobile: true,
      render: bill => formatMoney(bill.amountPaid),
    },
    { key: 'status', header: 'Status', render: statusCell },
    { key: 'actions', header: 'Actions', render: actionButtons },
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
            <Button variant="primary" icon="plus" hint={`${modLabel}+N`} onClick={handleGenerate}>
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
          rows={filteredBills}
          rowKey={bill => bill._id}
          onRowClick={bill => navigate(`/bills/${bill._id}`)}
          empty={
            (bills || []).length === 0 ? (
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
                <span key="amount" className="mono">
                  {formatMoney(bill.totalAmount)}
                </span>,
                <span key="paid" className="mono">
                  Paid {formatMoney(bill.amountPaid)}
                </span>,
                periodOf(bill),
              ];
            },
            actions: actionButtons,
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
    </div>
  );
}
