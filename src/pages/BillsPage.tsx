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
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { BillForm } from '../components/forms/BillForm';
import { BulkBillForm } from '../components/forms/BulkBillForm';
import { BulkBillProgress } from '../components/BulkBillProgress';
import { getErrorMessage } from '../api/baseApi';
import type { Bill, GenerateBillInput, BulkGenerateBillInput } from '../types';

type TableItem = Record<string, unknown>;

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

  useHotkey('alt+n', () => { if (!isModalOpen && !isBulkModalOpen) handleGenerate(); });
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
    return parties?.find((p) => p._id === partyId)?.name || 'Unknown';
  };

  const filteredBills = (bills || []).filter((bill) => {
    const matchesSearch =
      !searchTerm ||
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPartyName(bill.partyId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: 'billNumber', header: 'Bill #' },
    {
      key: 'billDate',
      header: 'Bill Date',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        const date = bill.billDate ?? bill.billingPeriod?.end ?? bill.createdAt;
        return date ? new Date(date).toLocaleDateString() : '-';
      },
    },
    {
      key: 'partyId',
      header: 'Party',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return getPartyName(bill.partyId);
      },
    },
    {
      key: 'billingPeriod',
      header: 'Period',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return `${new Date(bill.billingPeriod.start).toLocaleDateString()} - ${new Date(bill.billingPeriod.end).toLocaleDateString()}`;
      },
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return `₹${bill.totalAmount.toLocaleString()}`;
      },
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return `₹${bill.amountPaid.toLocaleString()}`;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className={`status status-${bill.status}`}>{bill.status}</span>
            {bill.isStale && (
              <span
                title="Stale — underlying challan data changed"
                className="badge-warning"
              >
                &#9888; Stale
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return (
          <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPdf(bill);
              }}
              title="Download invoice PDF"
              disabled={isDownloading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-inline">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
            {bill.status === 'draft' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleSendEmail(bill)}
              >
                Send
              </button>
            )}
            {(bill.status === 'sent' || bill.status === 'partial') && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleStatusChange(bill, 'paid')}
              >
                Mark Paid
              </button>
            )}
            <button
              className="btn btn-sm btn-danger"
              onClick={() => handleDelete(bill)}
              title={
                bill.status === 'draft' || bill.status === 'cancelled'
                  ? 'Delete bill'
                  : 'Force delete (bill has payments/status)'
              }
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading bills..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Bills</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleBulkGenerate}>
            Bulk Generate
          </button>
          <button className="btn btn-primary" onClick={handleGenerate}>
            + Generate Bill <kbd className="kbd-hint">{modLabel}+N</kbd>
          </button>
        </div>
      </div>

      <BulkBillProgress batches={batches} onDismiss={dismissBatch} />

      <div className="filters">
        <div className="search-wrapper">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <kbd className="kbd-hint search-kbd">/</kbd>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <DataTable
        data={filteredBills as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        onRowClick={(row) => navigate(`/bills/${String(row._id)}`)}
        emptyMessage="No bills found. Generate your first bill to get started."
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate Bill" size="form">
        <BillForm
          parties={parties || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isGenerating}
        />
      </Modal>

      <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="Bulk Generate Bills" size="form">
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
