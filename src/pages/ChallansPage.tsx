/**
 * Challans management page
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useChangeGate } from '../hooks/useChangeGate';
import { useHotkey } from '../hooks/useHotkey';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import { useAuth } from '../hooks/useAuth';
import {
  useGetChallansPageQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import {
  BulkActionBar,
  Button,
  Card,
  DataTable,
  DocNumber,
  Dot,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Spinner,
  StatusChip,
  type Column,
  type ModalVariant,
} from '../components/ui';
import { ChallanForm } from '../components/forms/ChallanForm';
import { getErrorMessage } from '../api/baseApi';
import { formatDate } from '../utils/format';
import type { Challan, CreateChallanInput } from '../types';
import { MessageDialog, useBulkSelection, useConfirm } from '../components/bulk';
import { useChallanBulkActions } from './challans/useChallanBulkActions';
import styles from './ChallansPage.module.css';

type TypeFilter = 'all' | Challan['type'];

const TYPE_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'delivery' as const, label: 'Delivery', dot: 'info' as const },
  { value: 'return' as const, label: 'Return', dot: 'warning' as const },
];

const TYPE_LABEL: Record<Challan['type'], string> = { delivery: 'Delivery', return: 'Return' };

const itemsLabel = (c: Challan) => `${c.items.length} ${c.items.length === 1 ? 'item' : 'items'}`;

function TypeDot({ type }: { type: Challan['type'] }) {
  return <Dot tone={type === 'delivery' ? 'info' : 'warning'} />;
}

export function ChallansPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>('delivery');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Filters and search run on the server; the table shows one page at a time.
  const search = useDebouncedValue(searchTerm.trim());
  const type = typeFilter === 'all' ? undefined : typeFilter;
  const filtersKey = `${search}|${type ?? ''}|${statusFilter}`;
  const [lastTotal, setLastTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useListPage(filtersKey, lastTotal);

  // The paged query's args minus `page`; also the source detail pages re-fetch from to step.
  const listArgs = {
    businessId: currentBusinessId || '',
    pageSize: LIST_PAGE_SIZE,
    search: search || undefined,
    status: statusFilter || undefined,
    type,
  };
  const {
    data: pageData,
    currentData,
    isLoading,
    error,
    refetch,
  } = useGetChallansPageQuery({ ...listArgs, page }, { skip: !currentBusinessId });
  if (pageData && pageData.total !== lastTotal) setLastTotal(pageData.total);
  const hasFilters = Boolean(search || type || statusFilter);

  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createChallan, { isLoading: isCreating }] = useCreateChallanMutation();
  const [confirmChallan] = useConfirmChallanMutation();
  const { run: runGated, dialog: changeDialog } = useChangeGate();
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const confirmDialog = useConfirm();
  const confirmedBy = user?.name || user?.email || 'Unknown';

  const challans = pageData?.rows ?? [];

  // Selection is per page of the server list: it clears on page, filter, search or business change.
  const selection = useBulkSelection({
    rows: challans,
    rowKey: c => c._id,
    resetKey: `${currentBusinessId}|${filtersKey}|${page}`,
    label: c => `Select ${c.challanNumber}`,
  });
  const selectedChallans = selection.selectedRows;
  const bulk = useChallanBulkActions({
    businessId: currentBusinessId || '',
    challans: selectedChallans,
    confirmedBy,
    ask: confirmDialog.ask,
    onSucceeded: selection.remove,
  });

  const handleCreateDelivery = () => {
    setModalVariant('delivery');
    setIsModalOpen(true);
  };

  const handleCreateReturn = () => {
    setModalVariant('return');
    setIsModalOpen(true);
  };

  useHotkey('alt+d', () => {
    if (!isModalOpen) handleCreateDelivery();
  });
  useHotkey('alt+r', () => {
    if (!isModalOpen) handleCreateReturn();
  });
  useHotkey('/', () => searchRef.current?.focus());

  const handleSubmit = async (data: CreateChallanInput) => {
    try {
      const saved = await runGated(gate =>
        createChallan({
          businessId: currentBusinessId!,
          data,
          ...gate,
        }).unwrap()
      );
      if (saved) setIsModalOpen(false);
    } catch (err) {
      setFailure({ title: "Couldn't create challan", message: getErrorMessage(err) });
    }
  };

  const confirmOne = async (challan: Challan) => {
    try {
      await runGated(gate =>
        confirmChallan({
          businessId: currentBusinessId!,
          challanId: challan._id,
          confirmedBy,
          ...gate,
        }).unwrap()
      );
    } catch (err) {
      setFailure({ title: "Couldn't confirm challan", message: getErrorMessage(err) });
    }
  };

  // The confirm dialog closes straight away; the change dialog may follow on its own.
  const handleConfirm = (challan: Challan) =>
    confirmDialog.ask({
      title: `Confirm challan ${challan.challanNumber}?`,
      confirmLabel: 'Confirm',
      onConfirm: () => {
        void confirmOne(challan);
      },
    });

  // Get party name by ID
  const getPartyName = (partyId: string) => {
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  // Get site code from party's agreement
  const getSiteCode = (challan: Challan) => {
    const party = parties?.find(p => p._id === challan.partyId);
    const agreement = party?.agreements?.find(a => a.agreementId === challan.agreementId);
    return agreement?.siteCode ?? '—';
  };

  const hasDraftChallans = challans.some(c => c.status === 'draft');

  const confirmButton = (challan: Challan) =>
    challan.status === 'draft' ? (
      <Button size="sm" variant="primary" onClick={() => handleConfirm(challan)}>
        Confirm
      </Button>
    ) : null;

  const columns: Column<Challan>[] = [
    {
      key: 'challanNumber',
      header: 'Challan',
      render: c => <DocNumber value={c.challanNumber} to={`/challans/${c._id}`} />,
    },
    {
      key: 'type',
      header: 'Type',
      hideOnMobile: true,
      render: c => (
        <span className={styles.type}>
          <TypeDot type={c.type} />
          {TYPE_LABEL[c.type]}
        </span>
      ),
    },
    { key: 'partyId', header: 'Party', render: c => getPartyName(c.partyId) },
    { key: 'siteCode', header: 'Site', hideOnMobile: true, render: c => getSiteCode(c) },
    {
      key: 'date',
      header: 'Date',
      hideOnMobile: true,
      nowrap: true,
      render: c => formatDate(c.date),
    },
    {
      key: 'items',
      header: 'Items',
      mono: true,
      align: 'right',
      nowrap: true,
      hideOnMobile: true,
      render: c => c.items.length,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: c => <StatusChip status={c.status} />,
    },
    ...(hasDraftChallans
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            nowrap: true,
            render: confirmButton,
          } as Column<Challan>,
        ]
      : []),
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading challans…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader
        title="Challans"
        actions={
          <>
            <Button dot="info" hint={shortcutLabel('D')} onClick={handleCreateDelivery}>
              New delivery
            </Button>
            <Button dot="warning" hint={shortcutLabel('R')} onClick={handleCreateReturn}>
              New return
            </Button>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search challans"
          hint="/"
          placeholder="Search challan no. or party"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <SegmentedControl
          label="Type"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </FilterBar>

      {selection.mobileSelectAll}

      <Card padded={false}>
        <DataTable
          aria-label="Challans"
          columns={columns}
          rows={challans}
          rowKey={c => c._id}
          selection={selection.selectionProp}
          pagination={{
            page,
            pageSize: LIST_PAGE_SIZE,
            total: pageData?.total ?? 0,
            onPageChange: setPage,
            // Only while the rows match these args; stale rows get page-only context.
            navSource: currentData ? { list: 'challans', args: listArgs } : undefined,
          }}
          rowLink={c => `/challans/${c._id}`}
          empty={
            !hasFilters ? (
              <EmptyState
                title="No challans yet"
                action={
                  <Button variant="primary" icon="plus" onClick={handleCreateDelivery}>
                    New delivery
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No challans match these filters" />
            )
          }
          mobile={{
            leading: c => <TypeDot type={c.type} />,
            title: c => <DocNumber value={c.challanNumber} to={`/challans/${c._id}`} />,
            badge: c => <StatusChip status={c.status} />,
            subtitle: c => getPartyName(c.partyId),
            meta: c => [TYPE_LABEL[c.type], getSiteCode(c), formatDate(c.date), itemsLabel(c)],
            actions: confirmButton,
          }}
        />
      </Card>

      <BulkActionBar
        count={selectedChallans.length}
        noun={selectedChallans.length === 1 ? 'challan' : 'challans'}
        onClear={selection.clear}
      >
        {bulk.actions}
      </BulkActionBar>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Create ${modalVariant === 'return' ? 'return' : 'delivery'} challan`}
        variant={modalVariant}
        size="form"
      >
        <ChallanForm
          businessId={currentBusinessId!}
          type={modalVariant}
          parties={parties || []}
          inventoryItems={inventory || []}
          challans={challans || []}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>
      {changeDialog}
      {confirmDialog.dialog}
      {bulk.dialog}
      <MessageDialog
        title={failure?.title ?? ''}
        message={failure?.message ?? null}
        onClose={() => setFailure(null)}
      />
    </div>
  );
}
