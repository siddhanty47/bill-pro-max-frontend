/**
 * Parties management page. Selected rows (on the visible page) export to CSV or are deleted
 * one by one over the party delete endpoint; a server refusal is listed with its message.
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useChangeGate } from '../hooks/useChangeGate';
import { useHotkey } from '../hooks/useHotkey';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import {
  useGetOutstandingSummaryQuery,
  useGetPartiesQuery,
  useCreatePartyMutation,
  useDeletePartyMutation,
  useCreateAgreementMutation,
} from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import {
  BulkActionBar,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
  RowActions,
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { PartyForm } from '../components/forms/PartyForm';
import { AgreementForm } from '../components/forms/AgreementForm';
import { AddSiteModal } from '../components/AddSiteModal';
import { getErrorMessage } from '../api/baseApi';
import { formatMoney } from '../utils/format';
import { csvFileName, downloadCsv } from '../utils/csv';
import {
  ExportCsvButton,
  MessageDialog,
  useBulkDelete,
  useBulkSelection,
  useConfirm,
} from '../components/bulk';
import { activeAgreements, partiesCsv, roleLabel, siteCount } from './party/partiesCsv';
import type { Party, CreatePartyInput, CreateAgreementInput } from '../types';
import styles from './PartiesPage.module.css';

export function PartiesPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const confirmDialog = useConfirm();

  const {
    data: parties,
    isLoading,
    error,
    refetch,
  } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  // Opening balance + bills - payments per party
  const { data: outstandingSummary } = useGetOutstandingSummaryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const outstandingByParty = new Map(
    (outstandingSummary?.parties ?? []).map(p => [p.partyId, p.outstanding])
  );
  const outstandingAmount = (party: Party) => outstandingByParty.get(party._id) ?? 0;
  const outstandingOf = (party: Party) => formatMoney(outstandingAmount(party));

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createParty, { isLoading: isCreating }] = useCreatePartyMutation();
  const [deleteParty] = useDeletePartyMutation();
  const [createAgreement, { isLoading: isCreatingAgreement }] = useCreateAgreementMutation();
  const { run: runGated, dialog: changeDialog } = useChangeGate();

  const handleAddParty = () => {
    setSelectedParty(null);
    setIsPartyModalOpen(true);
  };

  useHotkey('alt+n', () => {
    if (!isPartyModalOpen) handleAddParty();
  });
  useHotkey('/', () => searchRef.current?.focus());

  const handleAddAgreement = (party: Party) => {
    setSelectedParty(party);
    setIsAgreementModalOpen(true);
  };

  const handleAddSite = (party: Party) => {
    setSelectedParty(party);
    setIsSiteModalOpen(true);
  };

  const removeParty = (party: Party) =>
    deleteParty({ businessId: currentBusinessId!, partyId: party._id }).unwrap();

  const handleDeleteParty = (party: Party) =>
    confirmDialog.ask({
      title: `Delete ${party.name}?`,
      body: "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await removeParty(party);
        } catch (err) {
          setFailure({ title: "Couldn't delete party", message: getErrorMessage(err) });
        }
      },
    });

  const handlePartySubmit = async (data: CreatePartyInput) => {
    try {
      await createParty({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsPartyModalOpen(false);
      setSelectedParty(null);
    } catch (err) {
      setFailure({ title: "Couldn't add party", message: getErrorMessage(err) });
    }
  };

  const handleAgreementSubmit = async (data: CreateAgreementInput) => {
    try {
      const saved = await runGated(gate =>
        createAgreement({
          businessId: currentBusinessId!,
          partyId: selectedParty!._id,
          data,
          ...gate,
        }).unwrap()
      );
      if (!saved) return;
      setIsAgreementModalOpen(false);
      setSelectedParty(null);
    } catch (err) {
      setFailure({ title: "Couldn't add agreement", message: getErrorMessage(err) });
    }
  };

  const filteredParties = (parties || []).filter(party => {
    const matchesSearch =
      !searchTerm ||
      party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.contact.person.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || party.roles.includes(roleFilter as 'client' | 'supplier');
    return matchesSearch && matchesRole;
  });

  // The table pages the whole list (so Prev/Next covers every party) on a page held here,
  // so the selection only ever covers the parties on screen. It clears on page, filter,
  // search or business change.
  const filtersKey = `${currentBusinessId}|${searchTerm}|${roleFilter}`;
  const [page, setPage] = useListPage(filtersKey, filteredParties.length);
  const pageRows = filteredParties.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);
  const selection = useBulkSelection({
    rows: pageRows,
    rowKey: party => party._id,
    resetKey: `${filtersKey}|${page}`,
    label: party => `Select ${party.name}`,
  });
  const selectedParties = selection.selectedRows;
  const bulkDelete = useBulkDelete({
    rows: selectedParties,
    rowKey: party => party._id,
    label: party => party.name,
    remove: removeParty,
    noun: { one: 'party', many: 'parties' },
    ask: confirmDialog.ask,
    onSucceeded: selection.remove,
  });
  const exportSelected = () =>
    downloadCsv(csvFileName('parties'), partiesCsv(selectedParties, outstandingAmount));

  const rowActions = (party: Party) => (
    <RowActions
      items={[
        { label: 'Add site', onClick: () => handleAddSite(party) },
        { label: 'Add agreement', onClick: () => handleAddAgreement(party) },
        { label: 'Delete', onClick: () => handleDeleteParty(party), tone: 'danger' },
      ]}
    />
  );

  const columns: Column<Party>[] = [
    { key: 'code', header: 'Code', mono: true, nowrap: true, render: party => party.code },
    { key: 'name', header: 'Name', render: party => party.name },
    { key: 'roles', header: 'Roles', render: roleLabel },
    {
      key: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      render: party => (
        <div>
          <div>{party.contact.person}</div>
          <div className={`mono ${styles.contactPhone}`}>{party.contact.phone}</div>
        </div>
      ),
    },
    {
      key: 'sitesAgreements',
      header: 'Sites / Agreements',
      align: 'right',
      nowrap: true,
      hideOnMobile: true,
      render: party => (
        <span title={party.sites?.map(s => s.code).join(', ') || 'None'}>
          <span className="mono">{siteCount(party)}</span>{' '}
          {siteCount(party) === 1 ? 'site' : 'sites'} /{' '}
          <span className="mono">{activeAgreements(party)}</span> active
        </span>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      mono: true,
      align: 'right',
      nowrap: true,
      render: outstandingOf,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: party => <StatusChip status={party.isActive ? 'active' : 'inactive'} />,
    },
    { key: 'actions', header: 'Actions', align: 'right', nowrap: true, render: rowActions },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading parties…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader
        title="Parties"
        actions={
          <Button variant="primary" icon="plus" hint={shortcutLabel('N')} onClick={handleAddParty}>
            Add party
          </Button>
        }
      />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search parties"
          hint="/"
          placeholder="Name, code or contact"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select aria-label="Role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="client">Clients</option>
          <option value="supplier">Suppliers</option>
        </Select>
      </FilterBar>

      {selection.mobileSelectAll}

      <Card padded={false}>
        <DataTable
          aria-label="Parties"
          columns={columns}
          rows={filteredParties}
          rowKey={party => party._id}
          rowLink={party => `/parties/${party._id}`}
          selection={selection.selectionProp}
          page={page}
          onPageChange={setPage}
          empty={
            (parties || []).length === 0 ? (
              <EmptyState
                title="No parties yet"
                action={
                  <Button variant="primary" icon="plus" onClick={handleAddParty}>
                    Add party
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No parties match these filters" />
            )
          }
          mobile={{
            leading: party => <span className="mono">{party.code}</span>,
            title: party => party.name,
            subtitle: party => party.contact.person,
            badge: party => <StatusChip status={party.isActive ? 'active' : 'inactive'} />,
            actionsPlacement: 'trailing',
            meta: party => [
              <span key="roles">{roleLabel(party)}</span>,
              <span key="sites">
                <span className="mono">{siteCount(party)}</span>{' '}
                {siteCount(party) === 1 ? 'site' : 'sites'}
              </span>,
              <span key="agreements">
                <span className="mono">{activeAgreements(party)}</span> active
              </span>,
              <span key="phone" className="mono">
                {party.contact.phone}
              </span>,
              <span key="outstanding" className="mono">
                {outstandingOf(party)}
              </span>,
            ],
            actions: rowActions,
          }}
        />
      </Card>

      <BulkActionBar
        count={selectedParties.length}
        noun={selectedParties.length === 1 ? 'party' : 'parties'}
        onClear={selection.clear}
      >
        <ExportCsvButton count={selectedParties.length} onExport={exportSelected} />
        {bulkDelete.button}
      </BulkActionBar>

      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        title="Add party"
        size="form"
      >
        <PartyForm
          onSubmit={handlePartySubmit}
          onCancel={() => setIsPartyModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>

      <Modal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        title={`Add agreement for ${selectedParty?.name || ''}`}
        size="form"
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
      {changeDialog}
      {confirmDialog.dialog}
      {bulkDelete.dialog}
      <MessageDialog
        title={failure?.title ?? ''}
        message={failure?.message ?? null}
        onClose={() => setFailure(null)}
      />
    </div>
  );
}
