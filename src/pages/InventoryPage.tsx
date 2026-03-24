/**
 * Inventory management page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import {
  useGetInventoryQuery,
  useCreateInventoryMutation,
  useDeleteInventoryMutation,
  useGetOpeningBalancesQuery,
} from '../api/inventoryApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { InventoryForm } from '../components/forms/InventoryForm';
import { ImportPresetModal } from '../components/ImportPresetModal';
import { CreatePresetModal } from '../components/CreatePresetModal';
import { getErrorMessage } from '../api/baseApi';
import type { Inventory, CreateInventoryInput } from '../types';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';

type TableItem = Record<string, unknown>;

export function InventoryPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { modLabel } = usePlatform();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportPresetOpen, setIsImportPresetOpen] = useState(false);
  const [isCreatePresetOpen, setIsCreatePresetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: inventory,
    isLoading,
    error,
    refetch,
  } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const { data: openingBalances } = useGetOpeningBalancesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createInventory, { isLoading: isCreating }] = useCreateInventoryMutation();
  const [deleteInventory] = useDeleteInventoryMutation();

  const handleAdd = () => {
    setIsModalOpen(true);
  };

  useHotkey('alt+n', () => { if (!isModalOpen) handleAdd(); });
  useHotkey('/', () => searchRef.current?.focus());

  const handleSubmit = async (data: CreateInventoryInput) => {
    try {
      await createInventory({
        businessId: currentBusinessId!,
        data,
      }).unwrap();
      setIsModalOpen(false);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleDelete = async (item: Inventory) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteInventory({
        businessId: currentBusinessId!,
        itemId: item._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const categories = [...new Set(inventory?.map((i) => i.category) || [])];

  const filteredInventory = (inventory || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    {
      key: 'totalQuantity',
      header: 'Total',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        return `${item.totalQuantity} ${item.unit}`;
      },
    },
    {
      key: 'availableQuantity',
      header: 'Available',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        const rented = computeRentedFromHistory(item.quantityHistory);
        return `${computeAvailable(item.totalQuantity, rented)} ${item.unit}`;
      },
    },
    {
      key: 'rentedQuantity',
      header: 'Rented',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        const rented = computeRentedFromHistory(item.quantityHistory) + (openingBalances?.[item._id] ?? 0);
        return `${rented} ${item.unit}`;
      },
    },
    {
      key: 'defaultRatePerDay',
      header: 'Daily Rate',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        return item.defaultRatePerDay ? `₹${item.defaultRatePerDay}` : '-';
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        const canDelete = (computeRentedFromHistory(item.quantityHistory) + (openingBalances?.[item._id] ?? 0)) === 0;
        return (
          <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => handleDelete(item)}
              disabled={!canDelete}
              title={!canDelete ? 'Cannot delete: items are currently rented' : 'Delete item'}
            >
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
    return <LoadingSpinner message="Loading inventory..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        <div className="action-buttons">
          <button className="btn btn-secondary" onClick={() => setIsImportPresetOpen(true)}>
            Import Preset
          </button>
          <button className="btn btn-secondary" onClick={() => setIsCreatePresetOpen(true)}>
            Create Preset
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            + Add Item <kbd className="kbd-hint">{modLabel}+N</kbd>
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search-wrapper">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <kbd className="kbd-hint search-kbd">/</kbd>
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        data={filteredInventory as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        onRowClick={(row) => navigate(`/inventory/${String(row._id)}`)}
        emptyMessage="No inventory items found. Add your first item to get started."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Inventory Item"
        size="form"
      >
        <InventoryForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>

      <ImportPresetModal
        isOpen={isImportPresetOpen}
        onClose={() => setIsImportPresetOpen(false)}
        businessId={currentBusinessId!}
        existingInventory={inventory || []}
      />

      <CreatePresetModal
        isOpen={isCreatePresetOpen}
        onClose={() => setIsCreatePresetOpen(false)}
        businessId={currentBusinessId!}
        inventory={inventory || []}
      />
    </div>
  );
}
