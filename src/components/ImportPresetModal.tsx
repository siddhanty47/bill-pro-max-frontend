/**
 * Multi-step modal for browsing, previewing, and importing inventory presets.
 */
import { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { LoadingSpinner } from './LoadingSpinner';
import { getErrorMessage } from '../api/baseApi';
import {
  useGetPresetsQuery,
  useLazyGetPresetByIdQuery,
  useImportPresetMutation,
} from '../api/presetApi';
import type { PresetSummary, InventoryPreset, ImportPresetResult, Inventory } from '../types';
import styles from './ImportPresetModal.module.css';

type Step = 'browse' | 'preview' | 'result';

interface ImportPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  existingInventory: Inventory[];
}

export function ImportPresetModal({ isOpen, onClose, businessId, existingInventory }: ImportPresetModalProps) {
  const [step, setStep] = useState<Step>('browse');
  const [selectedPreset, setSelectedPreset] = useState<InventoryPreset | null>(null);
  const [importResult, setImportResult] = useState<ImportPresetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');

  const { data: presets, isLoading: presetsLoading } = useGetPresetsQuery(undefined, { skip: !isOpen });
  const [fetchPreset, { isLoading: presetLoading }] = useLazyGetPresetByIdQuery();
  const [importPreset, { isLoading: importing }] = useImportPresetMutation();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('browse');
      setSelectedPreset(null);
      setImportResult(null);
      setError(null);
      setBrowseSearch('');
      setPreviewSearch('');
    }
  }, [isOpen]);

  const existingCodes = useMemo(() => {
    return new Set(existingInventory.map((item) => item.code.toUpperCase()));
  }, [existingInventory]);

  const handlePreview = async (preset: PresetSummary) => {
    setError(null);
    try {
      const result = await fetchPreset(preset._id).unwrap();
      setSelectedPreset(result);
      setStep('preview');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleImport = async () => {
    if (!selectedPreset) return;
    setError(null);
    try {
      const result = await importPreset({ businessId, presetId: selectedPreset._id }).unwrap();
      setImportResult(result);
      setStep('result');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleBack = () => {
    setStep('browse');
    setSelectedPreset(null);
    setError(null);
    setPreviewSearch('');
  };

  const filteredPresets = useMemo(() => {
    if (!presets || !browseSearch) return presets;
    const term = browseSearch.toLowerCase();
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.tags.some((t) => t.toLowerCase().includes(term))
    );
  }, [presets, browseSearch]);

  const filteredPreviewItems = useMemo(() => {
    if (!selectedPreset || !previewSearch) return selectedPreset?.items;
    const term = previewSearch.toLowerCase();
    return selectedPreset.items.filter(
      (item) =>
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [selectedPreset, previewSearch]);

  const willImport = selectedPreset?.items.filter((item) => !existingCodes.has(item.code.toUpperCase())).length ?? 0;
  const willSkip = selectedPreset?.items.filter((item) => existingCodes.has(item.code.toUpperCase())).length ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Preset" size="form">
      <div className={styles.stepIndicator}>
        <span className={`${styles.step} ${step === 'browse' ? styles.stepActive : ''}`}>1. Browse</span>
        <span className={`${styles.step} ${step === 'preview' ? styles.stepActive : ''}`}>2. Preview</span>
        <span className={`${styles.step} ${step === 'result' ? styles.stepActive : ''}`}>3. Result</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {step === 'browse' && (
        <>
          {presetsLoading ? (
            <LoadingSpinner message="Loading presets..." />
          ) : !presets?.length ? (
            <div className={styles.emptyState}>No presets available.</div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search presets..."
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                className={styles.searchInput}
              />
              {!filteredPresets?.length ? (
                <div className={styles.emptyState}>No presets match your search.</div>
              ) : (
              <div className={styles.presetList}>
              {filteredPresets.map((preset) => (
                <div
                  key={preset._id}
                  className={styles.presetCard}
                  onClick={() => handlePreview(preset)}
                >
                  <div className={styles.presetInfo}>
                    <div className={styles.presetName}>{preset.name}</div>
                    {preset.description && (
                      <div className={styles.presetDescription}>{preset.description}</div>
                    )}
                    <div className={styles.presetMeta}>
                      <span>{preset.itemCount} items</span>
                      {preset.isSystem && <span className={styles.systemBadge}>System</span>}
                    </div>
                  </div>
                </div>
              ))}
              </div>
              )}
            </>
          )}
        </>
      )}

      {step === 'preview' && (
        <>
          {presetLoading ? (
            <LoadingSpinner message="Loading preset items..." />
          ) : selectedPreset ? (
            <>
              <div className={styles.summary}>
                <span className={styles.summaryHighlight}>{willImport}</span> will be imported,{' '}
                <span>{willSkip}</span> already exist and will be skipped
              </div>
              <input
                type="text"
                placeholder="Search items..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className={styles.searchInput}
              />
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredPreviewItems || []).map((item) => {
                    const exists = existingCodes.has(item.code.toUpperCase());
                    return (
                      <tr key={item.code} className={exists ? styles.skippedRow : ''}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.category}</td>
                        <td>
                          {exists && <span className={styles.existsBadge}>Already exists</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={styles.actions}>
                <button className="btn btn-secondary" onClick={handleBack} disabled={importing}>
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing || willImport === 0}
                >
                  {importing ? 'Importing...' : `Import ${willImport} Items`}
                </button>
              </div>
            </>
          ) : null}
        </>
      )}

      {step === 'result' && importResult && (
        <>
          <div className={styles.resultMessage}>
            <div className={styles.resultImported}>{importResult.imported}</div>
            <div className={styles.resultLabel}>items imported successfully</div>
            {importResult.skipped > 0 && (
              <div className={styles.resultDetails}>
                {importResult.skipped} skipped (duplicate codes)
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
