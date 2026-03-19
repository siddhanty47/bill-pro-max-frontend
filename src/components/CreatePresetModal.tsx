/**
 * Modal for creating a new preset from a business's existing inventory.
 */
import { useState, useMemo } from 'react';
import { Modal } from './Modal';
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

export function CreatePresetModal({ isOpen, onClose, businessId, inventory }: CreatePresetModalProps) {
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
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [inventory, search]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
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
    setSelectedIds(new Set(filteredInventory.map((item) => item._id)));
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
      .filter((item) => selectedIds.has(item._id))
      .map((item) => ({
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create Preset" size="form">
      <form onSubmit={handleSubmit}>
        {error && <div className={`error-message ${styles.errorAlert}`}>{error}</div>}

        <div className="form-content">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="preset-name">Preset Name *</label>
              <input
                id="preset-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="preset-description">Description</label>
              <input
                id="preset-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Select Items</label>
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              disabled={isLoading}
            />
            <div className={styles.selectActions}>
              <button type="button" className={styles.selectBtn} onClick={selectAll}>
                Select All
              </button>
              <button type="button" className={styles.selectBtn} onClick={selectNone}>
                Clear
              </button>
            </div>
            <div className={styles.itemList}>
              {filteredInventory.map((item) => (
                <label key={item._id} className={styles.itemRow}>
                  <input
                    type="checkbox"
                    className={styles.itemCheckbox}
                    checked={selectedIds.has(item._id)}
                    onChange={() => toggleItem(item._id)}
                    disabled={isLoading}
                  />
                  <span className={styles.itemCode}>{item.code}</span>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemCategory}>{item.category}</span>
                </label>
              ))}
            </div>
            <div className={styles.selectionCount}>{selectedIds.size} items selected</div>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading || selectedIds.size === 0}>
            {isLoading ? 'Creating...' : 'Create Preset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
