/**
 * AgreementItemsModal Component
 * Modal for viewing and editing agreement items/rates
 */
import { useState, useMemo, useCallback } from 'react';
import { Modal } from './Modal';
import { CodeAutocomplete, type AutocompleteItem } from './CodeAutocomplete';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { 
  useGetAgreementRatesQuery, 
  useAddAgreementRateMutation, 
  useUpdateAgreementRateMutation 
} from '../api/agreementApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import type { AgreementRateWithItem } from '../types';
import styles from './AgreementItemsModal.module.css';

interface AgreementItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  agreementId: string;
  partyName: string;
}

/**
 * AgreementItemsModal - View and edit items in an agreement
 * 
 * Features:
 * - Table showing all items with: Code, Name, Category, Rate/Day
 * - Edit button per row to modify rate (inline editing)
 * - "Add Item" section using CodeAutocomplete for inventory selection
 * - Rate input field for new items
 */
export function AgreementItemsModal({
  isOpen,
  onClose,
  businessId,
  agreementId,
  partyName,
}: AgreementItemsModalProps) {
  // State for adding new items
  const [newItemSearch, setNewItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // State for editing rates
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // API queries and mutations
  const { 
    data: rates, 
    isLoading: isLoadingRates, 
    error: ratesError,
    refetch: refetchRates,
  } = useGetAgreementRatesQuery(
    { businessId, agreementId },
    { skip: !isOpen }
  );

  const { data: inventory } = useGetInventoryQuery(businessId, { skip: !isOpen });

  const [addAgreementRate, { isLoading: isAdding }] = useAddAgreementRateMutation();
  const [updateAgreementRate, { isLoading: isUpdating }] = useUpdateAgreementRateMutation();

  // Filter inventory items that are not already in the agreement
  const availableItems = useMemo<AutocompleteItem[]>(() => {
    if (!inventory || !rates) return [];
    
    const existingItemIds = new Set(rates.map(r => r.itemId));
    
    return inventory
      .filter(item => !existingItemIds.has(item._id))
      .map(item => ({
        id: item._id,
        code: item.code,
        label: item.name,
        sublabel: item.category,
      }));
  }, [inventory, rates]);

  /**
   * Handle adding a new item to the agreement
   */
  const handleAddItem = useCallback(async () => {
    if (!selectedItemId) {
      setAddError('Please select an item');
      return;
    }

    const ratePerDay = parseFloat(newRate);
    if (isNaN(ratePerDay) || ratePerDay < 0) {
      setAddError('Please enter a valid rate (0 or greater)');
      return;
    }

    try {
      setAddError(null);
      await addAgreementRate({
        businessId,
        agreementId,
        data: { itemId: selectedItemId, ratePerDay },
      }).unwrap();
      
      // Reset form
      setNewItemSearch('');
      setSelectedItemId(null);
      setNewRate('');
      refetchRates();
    } catch (err) {
      const error = err as { data?: { message?: string } };
      setAddError(error.data?.message || 'Failed to add item');
    }
  }, [selectedItemId, newRate, addAgreementRate, businessId, agreementId, refetchRates]);

  /**
   * Handle item selection from autocomplete
   */
  const handleItemSelect = useCallback((item: AutocompleteItem) => {
    setSelectedItemId(item.id);
    // Pre-populate rate if inventory item has default rate
    const inventoryItem = inventory?.find(i => i._id === item.id);
    if (inventoryItem?.defaultRatePerDay !== undefined) {
      setNewRate(inventoryItem.defaultRatePerDay.toString());
    }
  }, [inventory]);

  /**
   * Start editing a rate
   */
  const handleStartEdit = useCallback((item: AgreementRateWithItem) => {
    setEditingItemId(item.itemId);
    setEditRate(item.ratePerDay.toString());
    setEditError(null);
  }, []);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingItemId(null);
    setEditRate('');
    setEditError(null);
  }, []);

  /**
   * Save edited rate
   */
  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId) return;

    const ratePerDay = parseFloat(editRate);
    if (isNaN(ratePerDay) || ratePerDay < 0) {
      setEditError('Please enter a valid rate (0 or greater)');
      return;
    }

    try {
      setEditError(null);
      await updateAgreementRate({
        businessId,
        agreementId,
        itemId: editingItemId,
        data: { ratePerDay },
      }).unwrap();
      
      handleCancelEdit();
      refetchRates();
    } catch (err) {
      const error = err as { data?: { message?: string } };
      setEditError(error.data?.message || 'Failed to update rate');
    }
  }, [editingItemId, editRate, updateAgreementRate, businessId, agreementId, handleCancelEdit, refetchRates]);

  /**
   * Handle close and reset state
   */
  const handleClose = useCallback(() => {
    setNewItemSearch('');
    setSelectedItemId(null);
    setNewRate('');
    setAddError(null);
    handleCancelEdit();
    onClose();
  }, [onClose, handleCancelEdit]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Agreement Items - ${partyName}`}
    >
      <div className={styles.root}>
        {/* Loading state */}
        {isLoadingRates && <LoadingSpinner />}

        {/* Error state */}
        {ratesError && (
          <ErrorMessage error={ratesError} />
        )}

        {/* Items table */}
        {rates && rates.length > 0 && (
          <div className={styles.tableContainer}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Rate/Day</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((item) => (
                  <tr key={item.itemId}>
                    <td>{item.itemCode}</td>
                    <td>{item.itemName}</td>
                    <td>{item.itemCategory}</td>
                    <td>
                      {editingItemId === item.itemId ? (
                        <div className={styles.editRateInline}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editRate}
                            onChange={(e) => setEditRate(e.target.value)}
                            className={styles.editRateInput}
                          />
                        </div>
                      ) : (
                        `₹${item.ratePerDay.toFixed(2)}`
                      )}
                    </td>
                    <td>
                      {editingItemId === item.itemId ? (
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={isUpdating}
                            className="btn btn-primary btn-sm"
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit Rate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editError && <div className={styles.errorText}>{editError}</div>}
          </div>
        )}

        {/* Empty state */}
        {rates && rates.length === 0 && (
          <p className={styles.emptyMessage}>No items in this agreement yet.</p>
        )}

        {/* Add new item section */}
        <div className={styles.addItemSection}>
          <h4>Add New Item</h4>
          <div className={styles.addItemForm}>
            <div className={styles.addItemAutocomplete}>
              <CodeAutocomplete
                label="Select Item"
                placeholder="Type to search inventory..."
                value={newItemSearch}
                onChange={setNewItemSearch}
                items={availableItems}
                onSelect={handleItemSelect}
                disabled={isAdding}
              />
            </div>
            <div className={styles.addItemRate}>
              <label>Rate/Day *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="0.00"
                disabled={isAdding}
              />
            </div>
            <div className={styles.addItemButton}>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={isAdding || !selectedItemId}
                className="btn btn-primary"
              >
                {isAdding ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
          {addError && <div className={styles.errorText}>{addError}</div>}
        </div>
      </div>

    </Modal>
  );
}
