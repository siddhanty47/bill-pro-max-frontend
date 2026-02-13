/**
 * Parties management page
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetPartiesQuery,
  useCreatePartyMutation,
  useUpdatePartyMutation,
  useDeletePartyMutation,
  useCreateAgreementMutation,
} from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { PartyForm } from '../components/forms/PartyForm';
import { AgreementForm } from '../components/forms/AgreementForm';
import { AddSiteModal } from '../components/AddSiteModal';
import { getErrorMessage } from '../api/baseApi';
import type { Party, CreatePartyInput, CreateAgreementInput } from '../types';

type TableItem = Record<string, unknown>;

export function PartiesPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const {
    data: parties,
    isLoading,
    error,
    refetch,
  } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createParty, { isLoading: isCreating }] = useCreatePartyMutation();
  const [updateParty, { isLoading: isUpdating }] = useUpdatePartyMutation();
  const [deleteParty] = useDeletePartyMutation();
  const [createAgreement, { isLoading: isCreatingAgreement }] = useCreateAgreementMutation();

  const handleAddParty = () => {
    setSelectedParty(null);
    setIsPartyModalOpen(true);
  };

  const handleEditParty = (party: Party) => {
    setSelectedParty(party);
    setIsPartyModalOpen(true);
  };

  const handleAddAgreement = (party: Party) => {
    setSelectedParty(party);
    setIsAgreementModalOpen(true);
  };

  const handleAddSite = (party: Party) => {
    setSelectedParty(party);
    setIsSiteModalOpen(true);
  };

  const handleDeleteParty = async (party: Party) => {
    if (!confirm(`Delete party "${party.name}"?`)) return;
    try {
      await deleteParty({
        businessId: currentBusinessId!,
        partyId: party._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handlePartySubmit = async (data: CreatePartyInput) => {
    try {
      if (selectedParty) {
        await updateParty({
          businessId: currentBusinessId!,
          partyId: selectedParty._id,
          data,
        }).unwrap();
      } else {
        await createParty({
          businessId: currentBusinessId!,
          data,
        }).unwrap();
      }
      setIsPartyModalOpen(false);
      setSelectedParty(null);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleAgreementSubmit = async (data: CreateAgreementInput) => {
    try {
      await createAgreement({
        businessId: currentBusinessId!,
        partyId: selectedParty!._id,
        data,
      }).unwrap();
      setIsAgreementModalOpen(false);
      setSelectedParty(null);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Filter parties
  const filteredParties = (parties || []).filter((party) => {
    const matchesSearch =
      !searchTerm ||
      party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.contact.person.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || party.roles.includes(roleFilter as 'client' | 'supplier');
    return matchesSearch && matchesRole;
  });

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'roles',
      header: 'Roles',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        return party.roles.join(', ');
      },
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        return (
          <div>
            <div>{party.contact.person}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{party.contact.phone}</div>
          </div>
        );
      },
    },
    {
      key: 'sites',
      header: 'Sites',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        const siteCount = party.sites?.length || 0;
        return (
          <span title={party.sites?.map((s) => s.code).join(', ') || 'None'}>
            {siteCount} site{siteCount !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: 'agreements',
      header: 'Agreements',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        const active = party.agreements?.filter((a) => a.status === 'active').length || 0;
        return `${active} active`;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        return (
          <span className={`status status-${party.isActive ? 'active' : 'inactive'}`}>
            {party.isActive ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const party = row as unknown as Party;
        return (
          <div className="action-buttons">
            <button className="btn btn-sm btn-secondary" onClick={() => handleEditParty(party)}>
              Edit
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => handleAddSite(party)}>
              + Site
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => handleAddAgreement(party)}>
              + Agreement
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteParty(party)}>
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
    return <LoadingSpinner message="Loading parties..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Parties</h1>
        <button className="btn btn-primary" onClick={handleAddParty}>
          + Add Party
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search parties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="client">Clients</option>
          <option value="supplier">Suppliers</option>
        </select>
      </div>

      <DataTable
        data={filteredParties as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        emptyMessage="No parties found. Add your first party to get started."
      />

      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        title={selectedParty ? 'Edit Party' : 'Add Party'}
      >
        <PartyForm
          initialData={selectedParty || undefined}
          onSubmit={handlePartySubmit}
          onCancel={() => setIsPartyModalOpen(false)}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      <Modal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        title={`Add Agreement for ${selectedParty?.name || ''}`}
      >
        <AgreementForm
          inventoryItems={inventory || []}
          sites={selectedParty?.sites || []}
          existingAgreements={selectedParty?.agreements || []}
          onSubmit={handleAgreementSubmit}
          onCancel={() => setIsAgreementModalOpen(false)}
          isLoading={isCreatingAgreement}
        />
      </Modal>

      {selectedParty && currentBusinessId && (
        <AddSiteModal
          isOpen={isSiteModalOpen}
          onClose={() => {
            setIsSiteModalOpen(false);
            setSelectedParty(null);
          }}
          businessId={currentBusinessId}
          party={selectedParty}
        />
      )}
    </div>
  );
}
