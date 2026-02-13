/**
 * Challans management page
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetChallansQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { ChallanForm } from '../components/forms/ChallanForm';
import { getErrorMessage } from '../api/baseApi';
import type { Challan, CreateChallanInput } from '../types';

type TableItem = Record<string, unknown>;
import { useAuth } from '../hooks/useAuth';

export function ChallansPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const {
    data: challans,
    isLoading,
    error,
    refetch,
  } = useGetChallansQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createChallan, { isLoading: isCreating }] = useCreateChallanMutation();
  const [confirmChallan] = useConfirmChallanMutation();

  const handleCreate = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: CreateChallanInput) => {
    try {
      await createChallan({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleConfirm = async (challan: Challan) => {
    if (!confirm(`Confirm challan ${challan.challanNumber}?`)) return;
    try {
      await confirmChallan({
        businessId: currentBusinessId!,
        challanId: challan._id,
        confirmedBy: user?.name || user?.email || 'Unknown',
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Get party name by ID
  const getPartyName = (partyId: string) => {
    return parties?.find((p) => p._id === partyId)?.name || 'Unknown';
  };

  // Filter challans
  const filteredChallans = (challans || []).filter((challan) => {
    const matchesSearch =
      !searchTerm ||
      challan.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPartyName(challan.partyId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || challan.type === typeFilter;
    const matchesStatus = !statusFilter || challan.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const columns = [
    { key: 'challanNumber', header: 'Challan #' },
    {
      key: 'type',
      header: 'Type',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return (
          <span className={`status status-${challan.type === 'delivery' ? 'active' : 'pending'}`}>
            {challan.type}
          </span>
        );
      },
    },
    {
      key: 'partyId',
      header: 'Party',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return getPartyName(challan.partyId);
      },
    },
    {
      key: 'date',
      header: 'Date',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return new Date(challan.date).toLocaleDateString();
      },
    },
    {
      key: 'items',
      header: 'Items',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return `${challan.items.length} items`;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return <span className={`status status-${challan.status}`}>{challan.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return (
          <div className="action-buttons">
            {challan.status === 'draft' && (
              <button className="btn btn-sm btn-primary" onClick={() => handleConfirm(challan)}>
                Confirm
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading challans..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Challans</h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Create Challan
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search challans..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="delivery">Delivery</option>
          <option value="return">Return</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <DataTable
        data={filteredChallans as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        emptyMessage="No challans found. Create your first challan to get started."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Challan"
      >
        <ChallanForm
          parties={parties || []}
          inventoryItems={inventory || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>
    </div>
  );
}
