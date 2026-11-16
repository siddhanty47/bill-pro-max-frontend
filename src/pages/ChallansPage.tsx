/**
 * Challans management page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import { useAuth } from '../hooks/useAuth';
import {
  useGetChallansQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
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
import styles from './ChallansPage.module.css';

type TypeFilter = 'all' | Challan['type'];

const TYPE_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'delivery' as const, label: 'Delivery', dot: 'info' as const },
  { value: 'return' as const, label: 'Return', dot: 'warning' as const },
];

const TYPE_LABEL: Record<Challan['type'], string> = { delivery: 'Delivery', return: 'Return' };

const byNewest = (a: Challan, b: Challan) =>
  new Date(b.date).getTime() - new Date(a.date).getTime() ||
  b.challanNumber.localeCompare(a.challanNumber, undefined, { numeric: true });

const itemsLabel = (c: Challan) => `${c.items.length} ${c.items.length === 1 ? 'item' : 'items'}`;

function TypeDot({ type }: { type: Challan['type'] }) {
  return (
    <span
      className={`${styles.dot} ${type === 'delivery' ? styles.delivery : styles.return}`}
      aria-hidden="true"
    />
  );
}

export function ChallansPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modLabel, isMac } = usePlatform();
  const hint = (key: string) => `${modLabel}${isMac ? '' : '+'}${key}`;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>('delivery');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

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
    return parties?.find(p => p._id === partyId)?.name || 'Unknown';
  };

  // Get site code from party's agreement
  const getSiteCode = (challan: Challan) => {
    const party = parties?.find(p => p._id === challan.partyId);
    const agreement = party?.agreements?.find(a => a.agreementId === challan.agreementId);
    return agreement?.siteCode ?? '—';
  };

  // Filter challans, newest first
  const filteredChallans = (challans || [])
    .filter(challan => {
      const matchesSearch =
        !searchTerm ||
        challan.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPartyName(challan.partyId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || challan.type === typeFilter;
      const matchesStatus = !statusFilter || challan.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    })
    .sort(byNewest);

  const hasDraftChallans = filteredChallans.some(c => c.status === 'draft');

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
    { key: 'date', header: 'Date', hideOnMobile: true, render: c => formatDate(c.date) },
    {
      key: 'items',
      header: 'Items',
      mono: true,
      align: 'right',
      hideOnMobile: true,
      render: c => c.items.length,
    },
    { key: 'status', header: 'Status', render: c => <StatusChip status={c.status} /> },
    ...(hasDraftChallans
      ? [{ key: 'actions', header: 'Actions', render: confirmButton } as Column<Challan>]
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
            <Button dot="info" hint={hint('D')} onClick={handleCreateDelivery}>
              New delivery
            </Button>
            <Button dot="warning" hint={hint('R')} onClick={handleCreateReturn}>
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

      <Card padded={false}>
        <DataTable
          aria-label="Challans"
          columns={columns}
          rows={filteredChallans}
          rowKey={c => c._id}
          onRowClick={c => navigate(`/challans/${c._id}`)}
          empty={
            (challans || []).length === 0 ? (
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
    </div>
  );
}
