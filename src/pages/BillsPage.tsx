/**
 * Bills management page
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetBillsQuery,
  useGenerateBillMutation,
  useUpdateBillStatusMutation,
  useDeleteBillMutation,
} from '../api/billApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { BillForm } from '../components/forms/BillForm';
import { getErrorMessage } from '../api/baseApi';
import type { Bill, GenerateBillInput } from '../types';

type TableItem = Record<string, unknown>;

export function BillsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const [generateBill, { isLoading: isGenerating }] = useGenerateBillMutation();
  const [updateBillStatus] = useUpdateBillStatusMutation();
  const [deleteBill] = useDeleteBillMutation();

  const handleGenerate = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: GenerateBillInput) => {
    try {
      await generateBill({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsModalOpen(false);
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

  // Get party name by ID
  const getPartyName = (partyId: string) => {
    return parties?.find((p) => p._id === partyId)?.name || 'Unknown';
  };

  // Filter bills
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
      key: 'dueDate',
      header: 'Due Date',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return new Date(bill.dueDate).toLocaleDateString();
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return <span className={`status status-${bill.status}`}>{bill.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const bill = row as unknown as Bill;
        return (
          <div className="action-buttons">
            {bill.status === 'draft' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleStatusChange(bill, 'sent')}
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
        <button className="btn btn-primary" onClick={handleGenerate}>
          + Generate Bill
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search bills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
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
        emptyMessage="No bills found. Generate your first bill to get started."
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate Bill">
        <BillForm
          parties={parties || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isGenerating}
        />
      </Modal>
    </div>
  );
}
