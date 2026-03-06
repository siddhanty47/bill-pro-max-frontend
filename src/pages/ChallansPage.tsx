/**
 * Challans management page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import {
  useGetChallansQuery,
  useCreateChallanMutation,
  useConfirmChallanMutation,
} from '../api/challanApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { DataTable } from '../components/DataTable';
import { Modal, type ModalVariant } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { ChallanForm } from '../components/forms/ChallanForm';
import { getErrorMessage } from '../api/baseApi';
import type { Challan, CreateChallanInput } from '../types';
import styles from './ChallansPage.module.css';

type TableItem = Record<string, unknown>;
import { useAuth } from '../hooks/useAuth';

export function ChallansPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modLabel } = usePlatform();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>('delivery');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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

  useHotkey('alt+d', () => { if (!isModalOpen) handleCreateDelivery(); });
  useHotkey('alt+r', () => { if (!isModalOpen) handleCreateReturn(); });
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
    return parties?.find((p) => p._id === partyId)?.name || 'Unknown';
  };

  // Get site code from party's agreement
  const getSiteCode = (challan: Challan) => {
    const party = parties?.find((p) => p._id === challan.partyId);
    const agreement = party?.agreements?.find((a) => a.agreementId === challan.agreementId);
    return agreement?.siteCode ?? '—';
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

  // Split into delivery and return, sort each by challan number (highest first)
  const sortByChallanNumberDesc = (a: Challan, b: Challan) =>
    b.challanNumber.localeCompare(a.challanNumber, undefined, { numeric: true });
  const deliveryChallans = filteredChallans
    .filter((c) => c.type === 'delivery')
    .sort(sortByChallanNumberDesc);
  const returnChallans = filteredChallans
    .filter((c) => c.type === 'return')
    .sort(sortByChallanNumberDesc);

  const hasDraftChallans = filteredChallans.some((c) => c.status === 'draft');

  const columns = [
    { key: 'challanNumber', header: 'Challan #' },
    {
      key: 'partyId',
      header: 'Party',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return getPartyName(challan.partyId);
      },
    },
    {
      key: 'siteCode',
      header: 'Site',
      render: (row: TableItem) => {
        const challan = row as unknown as Challan;
        return getSiteCode(challan);
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
    ...(hasDraftChallans
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (row: TableItem) => {
              const challan = row as unknown as Challan;
              return (
                <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                  {challan.status === 'draft' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleConfirm(challan)}>
                      Confirm
                    </button>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
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
        <div className={styles.createButtons}>
          <button className={`btn ${styles.btnDelivery}`} onClick={handleCreateDelivery}>
            + Delivery Challan <kbd className="kbd-hint">{modLabel}+D</kbd>
          </button>
          <button className={`btn ${styles.btnReturn}`} onClick={handleCreateReturn}>
            + Return Challan <kbd className="kbd-hint">{modLabel}+R</kbd>
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search-wrapper">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search challans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <kbd className="kbd-hint search-kbd">/</kbd>
        </div>
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

      <section className={styles.section}>
        <h2 className={`${styles.sectionHeader} ${styles.sectionHeaderDelivery}`}>
          Delivery Challans
        </h2>
        <DataTable
          data={deliveryChallans as unknown as TableItem[]}
          columns={columns}
          keyField="_id"
          onRowClick={(row) => navigate(`/challans/${String(row._id)}`)}
          emptyMessage="No delivery challans found."
        />
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.sectionHeader} ${styles.sectionHeaderReturn}`}>
          Return Challans
        </h2>
        <DataTable
          data={returnChallans as unknown as TableItem[]}
          columns={columns}
          keyField="_id"
          onRowClick={(row) => navigate(`/challans/${String(row._id)}`)}
          emptyMessage="No return challans found."
        />
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Create ${modalVariant === 'return' ? 'Return' : 'Delivery'} Challan`}
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
