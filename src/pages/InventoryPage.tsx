/**
 * Inventory management page
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { shortcutLabel } from '../hooks/usePlatform';
import {
  useGetInventoryQuery,
  useCreateInventoryMutation,
  useDeleteInventoryMutation,
  useGetOpeningBalancesQuery,
} from '../api/inventoryApi';
import {
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
  type Column,
} from '../components/ui';
import { InventoryForm } from '../components/forms/InventoryForm';
import { ImportPresetModal } from '../components/ImportPresetModal';
import { CreatePresetModal } from '../components/CreatePresetModal';
import { getErrorMessage } from '../api/baseApi';
import { formatMoney } from '../utils/format';
import type { Inventory, CreateInventoryInput } from '../types';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';

export function InventoryPage() {
  const { currentBusinessId } = useCurrentBusiness();
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

  useHotkey('alt+n', () => {
    if (!isModalOpen) handleAdd();
  });
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

  const categories = [...new Set(inventory?.map(i => i.category) || [])];

  const filteredInventory = (inventory || []).filter(item => {
    const matchesSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const rentedOf = (item: Inventory) =>
    computeRentedFromHistory(item.quantityHistory) + (openingBalances?.[item._id] ?? 0);
  const availableOf = (item: Inventory) =>
    computeAvailable(item.totalQuantity, computeRentedFromHistory(item.quantityHistory));
  const qty = (n: number, item: Inventory) => `${n} ${item.unit}`;

  const rowActions = (item: Inventory) => (
    <RowActions
      items={[
        {
          label: 'Delete',
          onClick: () => handleDelete(item),
          tone: 'danger',
          disabled: rentedOf(item) !== 0,
          hint: rentedOf(item) !== 0 ? 'Items are currently rented' : undefined,
        },
      ]}
    />
  );

  const columns: Column<Inventory>[] = [
    { key: 'code', header: 'Code', mono: true, nowrap: true, render: item => item.code },
    { key: 'name', header: 'Name', render: item => item.name },
    { key: 'category', header: 'Category', hideOnMobile: true, render: item => item.category },
    {
      key: 'totalQuantity',
      header: 'Total',
      mono: true,
      align: 'right',
      nowrap: true,
      render: item => qty(item.totalQuantity, item),
    },
    {
      key: 'availableQuantity',
      header: 'Available',
      mono: true,
      align: 'right',
      nowrap: true,
      render: item => qty(availableOf(item), item),
    },
    {
      key: 'rentedQuantity',
      header: 'Rented',
      mono: true,
      align: 'right',
      nowrap: true,
      hideOnMobile: true,
      render: item => qty(rentedOf(item), item),
    },
    {
      key: 'defaultRatePerDay',
      header: 'Daily rate',
      mono: true,
      align: 'right',
      nowrap: true,
      hideOnMobile: true,
      render: item => (item.defaultRatePerDay ? formatMoney(item.defaultRatePerDay) : '—'),
    },
    { key: 'actions', header: 'Actions', align: 'right', nowrap: true, render: rowActions },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading inventory…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        actions={
          <>
            <Button onClick={() => setIsImportPresetOpen(true)}>Import preset</Button>
            <Button onClick={() => setIsCreatePresetOpen(true)}>Create preset</Button>
            <Button variant="primary" icon="plus" hint={shortcutLabel('N')} onClick={handleAdd}>
              Add item
            </Button>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search inventory"
          hint="/"
          placeholder="Search name, code or category"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select
          aria-label="Category"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
      </FilterBar>

      <Card padded={false}>
        <DataTable
          aria-label="Inventory"
          columns={columns}
          rows={filteredInventory}
          rowKey={item => item._id}
          rowLink={item => `/inventory/${item._id}`}
          empty={
            (inventory || []).length === 0 ? (
              <EmptyState
                title="No inventory items yet"
                action={
                  <Button variant="primary" icon="plus" onClick={handleAdd}>
                    Add item
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No items match these filters" />
            )
          }
          mobile={{
            leading: item => <span className="mono">{item.code}</span>,
            title: item => item.name,
            subtitle: item => item.category,
            actionsPlacement: 'trailing',
            meta: item => [
              <span key="available">
                Available <span className="mono">{qty(availableOf(item), item)}</span>
              </span>,
              <span key="rented">
                Rented <span className="mono">{qty(rentedOf(item), item)}</span>
              </span>,
              item.defaultRatePerDay ? (
                <span key="rate" className="mono">
                  {formatMoney(item.defaultRatePerDay)}/day
                </span>
              ) : null,
            ],
            actions: rowActions,
          }}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add inventory item"
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
