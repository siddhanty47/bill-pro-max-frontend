/**
 * Modal for creating a new preset from a business's existing inventory.
 */
import { useState, useMemo, useId } from 'react';
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  SearchInput,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from './ui';
import { getErrorMessage } from '../api/baseApi';
import { useCreatePresetMutation } from '../api/presetApi';
import type { Inventory } from '../types';
import styles from './CreatePresetModal.module.css';

interface CreatePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  inventory: Inventory[];
}

export function CreatePresetModal({
  isOpen,
  onClose,
  businessId,
  inventory,
}: CreatePresetModalProps) {
  const pickerTitleId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createPreset, { isLoading }] = useCreatePresetMutation();

  const filteredInventory = useMemo(() => {
    if (!search) return inventory;
    const term = search.toLowerCase();
    return inventory.filter(
      item =>
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [inventory, search]);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredInventory.map(item => item._id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Preset name is required');
      return;
    }

    if (selectedIds.size === 0) {
      setError('Select at least one item');
      return;
    }

    const selectedItems = inventory
      .filter(item => selectedIds.has(item._id))
      .map(item => ({
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        description: item.description,
        defaultRatePerDay: item.defaultRatePerDay,
        damageRate: item.damageRate,
      }));

    try {
      await createPreset({
        businessId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          items: selectedItems,
        },
      }).unwrap();
      // Reset and close
      setName('');
      setDescription('');
      setSelectedIds(new Set());
      setSearch('');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create preset" size="form">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && <Notice tone="danger">{error}</Notice>}

        <div className={styles.fields}>
          <Field label="Preset name" required>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              disabled={isLoading}
            />
          </Field>
          <Field label="Description">
            <Input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              disabled={isLoading}
            />
          </Field>
        </div>

        <section className={styles.picker} aria-labelledby={pickerTitleId}>
          <h3 id={pickerTitleId} className={styles.pickerTitle}>
            Select items
          </h3>
          <SearchInput
            label="Search items"
            placeholder="Search items"
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={isLoading}
          />
          <div className={styles.selectActions}>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Clear
            </Button>
            <span className={styles.selectionCount}>{selectedIds.size} items selected</span>
          </div>
          {filteredInventory.length === 0 ? (
            <EmptyState
              title={inventory.length === 0 ? 'No items yet' : 'No items match your search'}
            />
          ) : (
            <Table className={styles.itemList} aria-label="Items to include">
              <THead>
                <Tr>
                  <Th aria-label="Include" />
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th hideOnMobile>Category</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredInventory.map(item => (
                  <Tr key={item._id} onClick={() => !isLoading && toggleItem(item._id)}>
                    <Td>
                      <Checkbox
                        aria-label={`Select ${item.code} ${item.name}`}
                        checked={selectedIds.has(item._id)}
                        onChange={() => toggleItem(item._id)}
                        disabled={isLoading}
                      />
                    </Td>
                    <Td mono nowrap>
                      {item.code}
                    </Td>
                    <Td>{item.name}</Td>
                    <Td hideOnMobile>{item.category}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        <div className={styles.actions}>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={isLoading}
            disabled={selectedIds.size === 0}
          >
            Create preset
          </Button>
        </div>
      </form>
    </Modal>
  );
}
