/**
 * Dashboard page with summary stats
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetInventoryStatsQuery } from '../api/inventoryApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetBillsQuery, useGetOverdueBillsQuery } from '../api/billApi';
import { useCreateBusinessMutation } from '../api/businessApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { BusinessForm } from '../components/forms/BusinessForm';
import { getErrorMessage } from '../api/baseApi';
import type { CreateBusinessInput } from '../types';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { currentBusinessId, currentBusiness, businesses, isLoading: businessLoading } = useCurrentBusiness();
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);

  const [createBusiness, { isLoading: isCreating }] = useCreateBusinessMutation();

  const { data: inventoryStats, isLoading: statsLoading } = useGetInventoryStatsQuery(
    currentBusinessId || '',
    { skip: !currentBusinessId }
  );

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: bills } = useGetBillsQuery(currentBusinessId || '', {
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

  if (businessLoading || statsLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  // Show create business prompt if no businesses exist
  if (!currentBusinessId && businesses.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1>Welcome to BillProMax</h1>
        </div>
        <div className="card">
          <h2>Get Started</h2>
          <p className={styles.getStartedText}>
            You don't have any businesses yet. Create your first business to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setIsBusinessModalOpen(true)}>
            + Create Business
          </button>
        </div>

        <Modal
          isOpen={isBusinessModalOpen}
          onClose={() => setIsBusinessModalOpen(false)}
          title="Create New Business"
        >
          <BusinessForm
            onSubmit={handleCreateBusiness}
            onCancel={() => setIsBusinessModalOpen(false)}
            isLoading={isCreating}
          />
        </Modal>
      </div>
    );
  }

  if (!currentBusinessId) {
    return (
      <div className="card">
        <p>No business selected. Please select a business from the dropdown above.</p>
      </div>
    );
  }

  const activeParties = parties?.filter((p) => p.isActive).length || 0;
  const pendingBills = bills?.filter((b) => b.status === 'sent' || b.status === 'partial').length || 0;
  const totalOutstanding = bills?.reduce((sum, b) => sum + (b.totalAmount - b.amountPaid), 0) || 0;

  return (
    <div className={styles.dashboard}>
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className={styles.headerActions}>
          {currentBusiness && <span>Welcome to {currentBusiness.name}</span>}
          <button className="btn btn-secondary" onClick={() => setIsBusinessModalOpen(true)}>
            + Add Business
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Inventory Items</h3>
          <div className="value">{inventoryStats?.totalItems || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Available Stock</h3>
          <div className="value">{inventoryStats?.availableQuantity || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Rented Out</h3>
          <div className="value">{inventoryStats?.rentedQuantity || 0}</div>
        </div>

        <div className="stat-card">
          <h3>Active Parties</h3>
          <div className="value">{activeParties}</div>
        </div>

        <div className="stat-card">
          <h3>Pending Bills</h3>
          <div className="value">{pendingBills}</div>
        </div>

        <div className="stat-card">
          <h3>Outstanding Amount</h3>
          <div className="value">₹{totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {overdueBills && overdueBills.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Overdue Bills ({overdueBills.length})</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overdueBills.slice(0, 5).map((bill) => (
                <tr key={bill._id}>
                  <td>{bill.billNumber}</td>
                  <td>{new Date(bill.dueDate).toLocaleDateString()}</td>
                  <td>₹{bill.totalAmount.toLocaleString()}</td>
                  <td><span className="status status-overdue">Overdue</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        title="Create New Business"
      >
        <BusinessForm
          onSubmit={handleCreateBusiness}
          onCancel={() => setIsBusinessModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>
    </div>
  );
}
