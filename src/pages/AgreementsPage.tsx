/**
 * Agreements management page
 * Lists all agreements across all parties with edit functionality
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetAgreementsQuery, useUpdateAgreementMutation } from '../api/agreementApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EditAgreementForm } from '../components/forms/EditAgreementForm';
import { AgreementItemsModal } from '../components/AgreementItemsModal';
import { getErrorMessage } from '../api/baseApi';
import type { AgreementWithParty, UpdateAgreementInput } from '../types';

type TableItem = Record<string, unknown>;

/**
 * AgreementsPage component
 * Displays a table of all agreements with filtering and edit options
 */
export function AgreementsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementWithParty | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const {
    data: agreements,
    isLoading,
    error,
    refetch,
  } = useGetAgreementsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [updateAgreement, { isLoading: isUpdating }] = useUpdateAgreementMutation();

  const handleEdit = (agreement: AgreementWithParty) => {
    setSelectedAgreement(agreement);
    setIsEditModalOpen(true);
  };

  const handleViewItems = (agreement: AgreementWithParty) => {
    setSelectedAgreement(agreement);
    setIsItemsModalOpen(true);
  };

  const handleSubmit = async (data: UpdateAgreementInput) => {
    if (!selectedAgreement) return;

    try {
      await updateAgreement({
        businessId: currentBusinessId!,
        agreementId: selectedAgreement.agreementId,
        data,
      }).unwrap();
      setIsEditModalOpen(false);
      setSelectedAgreement(null);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleTerminate = async (agreement: AgreementWithParty) => {
    if (!confirm(`Terminate agreement with "${agreement.partyName}"?`)) return;

    try {
      await updateAgreement({
        businessId: currentBusinessId!,
        agreementId: agreement.agreementId,
        data: { status: 'terminated' },
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Filter agreements
  const filteredAgreements = (agreements || []).filter((agreement) => {
    const matchesSearch =
      !searchTerm ||
      agreement.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.agreementId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.siteCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || agreement.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /**
   * Format date for display
   */
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const columns = [
    { key: 'agreementId', header: 'Agreement ID' },
    { key: 'partyName', header: 'Party' },
    { key: 'siteCode', header: 'Site' },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return formatDate(agreement.startDate);
      },
    },
    {
      key: 'endDate',
      header: 'End Date',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return formatDate(agreement.endDate);
      },
    },
    {
      key: 'terms',
      header: 'Billing Cycle',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return agreement.terms.billingCycle;
      },
    },
    {
      key: 'paymentDueDays',
      header: 'Payment Due',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return `${agreement.terms.paymentDueDays} days`;
      },
    },
    {
      key: 'rates',
      header: 'Items',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return (
          <button
            className="btn-link"
            onClick={() => handleViewItems(agreement)}
            title="Click to view/edit items"
          >
            {agreement.rates.length} items
          </button>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return (
          <span className={`status status-${agreement.status}`}>
            {agreement.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const agreement = row as unknown as AgreementWithParty;
        return (
          <div className="action-buttons">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleViewItems(agreement)}
              title="View/Edit Items"
            >
              Items
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => handleEdit(agreement)}
            >
              Edit
            </button>
            {agreement.status === 'active' && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleTerminate(agreement)}
              >
                Terminate
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
    return <LoadingSpinner message="Loading agreements..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Agreements</h1>
        <p className="page-description">
          Manage all agreements. To create a new agreement, go to the Parties page and click "+ Agreement" for a party.
        </p>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by party or agreement ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      <DataTable
        data={filteredAgreements as unknown as TableItem[]}
        columns={columns}
        keyField="agreementId"
        emptyMessage="No agreements found. Create agreements from the Parties page."
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Agreement - ${selectedAgreement?.partyName || ''}`}
      >
        {selectedAgreement && (
          <EditAgreementForm
            agreement={selectedAgreement}
            onSubmit={handleSubmit}
            onCancel={() => setIsEditModalOpen(false)}
            isLoading={isUpdating}
          />
        )}
      </Modal>

      {/* Agreement Items Modal */}
      {selectedAgreement && currentBusinessId && (
        <AgreementItemsModal
          isOpen={isItemsModalOpen}
          onClose={() => {
            setIsItemsModalOpen(false);
            setSelectedAgreement(null);
          }}
          businessId={currentBusinessId}
          agreementId={selectedAgreement.agreementId}
          partyName={selectedAgreement.partyName}
        />
      )}
    </div>
  );
}
