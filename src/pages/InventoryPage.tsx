/**
 * Inventory management page
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetInventoryQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
} from '../api/inventoryApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { InventoryForm } from '../components/forms/InventoryForm';
import { getErrorMessage } from '../api/baseApi';
import type { Inventory, CreateInventoryInput } from '../types';

type TableItem = Record<string, unknown>;

export function InventoryPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const {
    data: inventory,
    isLoading,
    error,
    refetch,
  } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [createInventory, { isLoading: isCreating }] = useCreateInventoryMutation();
  const [updateInventory, { isLoading: isUpdating }] = useUpdateInventoryMutation();

  const handleAdd = () => {
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Inventory) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: CreateInventoryInput) => {
    try {
      if (selectedItem) {
        await updateInventory({
          businessId: currentBusinessId!,
          itemId: selectedItem._id,
          data,
        }).unwrap();
      } else {
        await createInventory({
          businessId: currentBusinessId!,
          data,
        }).unwrap();
      }
      setIsModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Get unique categories for filter
  const categories = [...new Set(inventory?.map((i) => i.category) || [])];

  // Filter inventory
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
        return `${item.availableQuantity} ${item.unit}`;
      },
    },
    {
      key: 'rentedQuantity',
      header: 'Rented',
      render: (row: TableItem) => {
        const item = row as unknown as Inventory;
        return `${item.rentedQuantity} ${item.unit}`;
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
        return (
          <div className="action-buttons">
            <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)}>
              Edit
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
        <button className="btn btn-primary" onClick={handleAdd}>
          + Add Item
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
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
        emptyMessage="No inventory items found. Add your first item to get started."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
      >
        <InventoryForm
          initialData={selectedItem || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating || isUpdating}
        />
      </Modal>
    </div>
  );
}
