/**
 * Agreements management page
 * Lists all agreements across all parties
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetAgreementsQuery } from '../api/agreementApi';
import { DataTable } from '../components/DataTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { AgreementWithParty } from '../types';

type TableItem = Record<string, unknown>;

/**
 * AgreementsPage component
 * Displays a table of all agreements with filtering options.
 * Editing is handled on the detail view page.
 */
export function AgreementsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();
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
        return `${agreement.rates.length} items`;
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
          <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate(`/agreements/${agreement.agreementId}`)}
            >
              View
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
          Manage all agreements. To create a new agreement, go to the Parties page and click &quot;+ Agreement&quot; for a party.
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
        onRowClick={(row) => navigate(`/agreements/${String(row.agreementId)}`)}
        emptyMessage="No agreements found. Create agreements from the Parties page."
      />
    </div>
  );
}
