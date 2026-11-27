/**
 * Inventory management page. Selected rows (on the visible page) export to CSV or are deleted
 * one by one over the item delete endpoint; rented items and server refusals are skipped.
 */
import { useState, useRef } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { LIST_PAGE_SIZE, useListPage } from '../hooks/useListPage';
import { shortcutLabel } from '../hooks/usePlatform';
import {
  useGetInventoryQuery,
  useCreateInventoryMutation,
  useDeleteInventoryMutation,
  useGetOpeningBalancesQuery,
} from '../api/inventoryApi';
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
  type Column,
} from '../components/ui';
import { InventoryForm } from '../components/forms/InventoryForm';
import { ImportPresetModal } from '../components/ImportPresetModal';
import { CreatePresetModal } from '../components/CreatePresetModal';
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
import { inventoryCsv } from './inventory/inventoryCsv';
import { RENTED_REASON } from './inventory/bulkReasons';
import type { Inventory, CreateInventoryInput } from '../types';
import { computeRentedFromHistory, computeAvailable } from '../utils/inventoryUtils';
import { matchesSearch } from '../utils/search';

export function InventoryPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportPresetOpen, setIsImportPresetOpen] = useState(false);
  const [isCreatePresetOpen, setIsCreatePresetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const confirmDialog = useConfirm();

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
      setFailure({ title: "Couldn't add item", message: getErrorMessage(err) });
    }
  };

  const removeItem = (item: Inventory) =>
    deleteInventory({ businessId: currentBusinessId!, itemId: item._id }).unwrap();

  const handleDelete = (item: Inventory) =>
    confirmDialog.ask({
      title: `Delete ${item.name}?`,
      body: "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await removeItem(item);
        } catch (err) {
          setFailure({ title: "Couldn't delete item", message: getErrorMessage(err) });
        }
      },
    });

  const categories = [...new Set(inventory?.map(i => i.category) || [])];

  const filteredInventory = (inventory || []).filter(item => {
    const matchesText = matchesSearch(searchTerm, [
      item.name,
      item.code,
      item.category,
      item.description,
    ]);
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesText && matchesCategory;
  });

  const rentedOf = (item: Inventory) =>
    computeRentedFromHistory(item.quantityHistory) + (openingBalances?.[item._id] ?? 0);
  const availableOf = (item: Inventory) =>
    computeAvailable(item.totalQuantity, computeRentedFromHistory(item.quantityHistory));
  const qty = (n: number, item: Inventory) => `${n} ${item.unit}`;

  // The table pages the whole list (so Prev/Next covers every item) on a page held here,
  // so the selection only ever covers the items on screen. It clears on page, filter,
  // search or business change.
  const filtersKey = `${currentBusinessId}|${searchTerm}|${categoryFilter}`;
  const [page, setPage] = useListPage(filtersKey, filteredInventory.length);
  const pageRows = filteredInventory.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);
  const selection = useBulkSelection({
    rows: pageRows,
    rowKey: item => item._id,
    resetKey: `${filtersKey}|${page}`,
    label: item => `Select ${item.name}`,
  });
  const selectedItems = selection.selectedRows;
  const bulkDelete = useBulkDelete({
    rows: selectedItems,
    rowKey: item => item._id,
    label: item => item.name,
    remove: removeItem,
    skipReason: item => (rentedOf(item) !== 0 ? RENTED_REASON : null),
    noun: { one: 'item', many: 'items' },
    ask: confirmDialog.ask,
    onSucceeded: selection.remove,
  });
  const exportSelected = () =>
    downloadCsv(
      csvFileName('inventory'),
      inventoryCsv(selectedItems, { available: availableOf, rented: rentedOf })
    );

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
          placeholder="Search name, code, category or description"
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

      {selection.mobileSelectAll}

      <Card padded={false}>
        <DataTable
          aria-label="Inventory"
          columns={columns}
          rows={filteredInventory}
          rowKey={item => item._id}
          rowLink={item => `/inventory/${item._id}`}
          selection={selection.selectionProp}
          page={page}
          onPageChange={setPage}
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

      <BulkActionBar
        count={selectedItems.length}
        noun={selectedItems.length === 1 ? 'item' : 'items'}
        onClear={selection.clear}
      >
        <ExportCsvButton count={selectedItems.length} onExport={exportSelected} />
        {bulkDelete.button}
      </BulkActionBar>

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
