/**
 * Payments management page
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetPaymentsQuery, useCreatePaymentMutation } from '../api/paymentApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetBillsQuery } from '../api/billApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { PaymentForm } from '../components/forms/PaymentForm';
import { getErrorMessage } from '../api/baseApi';
import type { Payment, CreatePaymentInput } from '../types';

type TableItem = Record<string, unknown>;

export function PaymentsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

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

  // Get party name by ID
  const getPartyName = (partyId: string) => {
    return parties?.find((p) => p._id === partyId)?.name || 'Unknown';
  };

  // Filter payments
  const filteredPayments = (payments || []).filter((payment) => {
    const matchesSearch =
      !searchTerm ||
      getPartyName(payment.partyId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.reference && payment.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = !typeFilter || payment.type === typeFilter;
    const matchesMethod = !methodFilter || payment.method === methodFilter;
    return matchesSearch && matchesType && matchesMethod;
  });

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return new Date(payment.date).toLocaleDateString();
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return (
          <span className={`status status-${payment.type === 'receivable' ? 'active' : 'pending'}`}>
            {payment.type === 'receivable' ? 'Received' : 'Paid'}
          </span>
        );
      },
    },
    {
      key: 'partyId',
      header: 'Party',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return getPartyName(payment.partyId);
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return `₹${payment.amount.toLocaleString()}`;
      },
    },
    {
      key: 'method',
      header: 'Method',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return payment.method.replace('_', ' ');
      },
    },
    { key: 'reference', header: 'Reference' },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const payment = row as unknown as Payment;
        return <span className={`status status-${payment.status}`}>{payment.status}</span>;
      },
    },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading payments..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  // Calculate summary stats
  const totalReceived = (payments || [])
    .filter((p) => p.type === 'receivable' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = (payments || [])
    .filter((p) => p.type === 'payable' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Payments</h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Record Payment
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <h3>Total Received</h3>
          <div className="value" style={{ color: '#28a745' }}>
            ₹{totalReceived.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <h3>Total Paid</h3>
          <div className="value" style={{ color: '#dc3545' }}>
            ₹{totalPaid.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <h3>Net</h3>
          <div className="value">₹{(totalReceived - totalPaid).toLocaleString()}</div>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search payments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="receivable">Received</option>
          <option value="payable">Paid</option>
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
      </div>

      <DataTable
        data={filteredPayments as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        emptyMessage="No payments found. Record your first payment to get started."
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Payment">
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
