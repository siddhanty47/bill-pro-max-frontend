/**
 * Multi-step modal for browsing, previewing, and importing inventory presets.
 */
import { useState, useMemo } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  Modal,
  Notice,
  SearchInput,
  Spinner,
  type Column,
} from './ui';
import { getErrorMessage } from '../api/baseApi';
import {
  useGetPresetsQuery,
  useLazyGetPresetByIdQuery,
  useImportPresetMutation,
} from '../api/presetApi';
import type {
  PresetSummary,
  PresetItem,
  InventoryPreset,
  ImportPresetResult,
  Inventory,
} from '../types';
import styles from './ImportPresetModal.module.css';

type Step = 'browse' | 'preview' | 'result';

const STEPS: { id: Step; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'preview', label: 'Preview' },
  { id: 'result', label: 'Result' },
];

interface ImportPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  existingInventory: Inventory[];
}

export function ImportPresetModal({
  isOpen,
  onClose,
  businessId,
  existingInventory,
}: ImportPresetModalProps) {
  const [step, setStep] = useState<Step>('browse');
  const [selectedPreset, setSelectedPreset] = useState<InventoryPreset | null>(null);
  const [importResult, setImportResult] = useState<ImportPresetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');

  const { data: presets, isLoading: presetsLoading } = useGetPresetsQuery(undefined, {
    skip: !isOpen,
  });
  const [fetchPreset, { isLoading: presetLoading }] = useLazyGetPresetByIdQuery();
  const [importPreset, { isLoading: importing }] = useImportPresetMutation();

  // Reset state each time the modal opens (adjust state during render).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setStep('browse');
      setSelectedPreset(null);
      setImportResult(null);
      setError(null);
      setBrowseSearch('');
      setPreviewSearch('');
    }
  }

  const existingCodes = useMemo(() => {
    return new Set(existingInventory.map(item => item.code.toUpperCase()));
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
      p =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
    );
  }, [presets, browseSearch]);

  const filteredPreviewItems = useMemo(() => {
    if (!selectedPreset || !previewSearch) return selectedPreset?.items;
    const term = previewSearch.toLowerCase();
    return selectedPreset.items.filter(
      item =>
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [selectedPreset, previewSearch]);

  const willImport =
    selectedPreset?.items.filter(item => !existingCodes.has(item.code.toUpperCase())).length ?? 0;
  const willSkip =
    selectedPreset?.items.filter(item => existingCodes.has(item.code.toUpperCase())).length ?? 0;

  const presetColumns: Column<PresetSummary>[] = [
    {
      key: 'name',
      header: 'Preset',
      render: p => (
        <>
          <span className={styles.presetName}>{p.name}</span>
          {p.description && <span className={styles.presetDescription}>{p.description}</span>}
        </>
      ),
    },
    { key: 'itemCount', header: 'Items', align: 'right', mono: true, nowrap: true },
    {
      key: 'isSystem',
      header: 'Type',
      nowrap: true,
      render: p => (p.isSystem ? 'System' : 'Custom'),
    },
  ];

  const previewColumns: Column<PresetItem>[] = [
    { key: 'code', header: 'Code', mono: true, nowrap: true },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: item =>
        existingCodes.has(item.code.toUpperCase()) ? (
          <span className={styles.exists}>Already exists</span>
        ) : null,
    },
  ];

  const activeIndex = STEPS.findIndex(s => s.id === step);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import preset" size="form">
      <div className={styles.body}>
        <ol className={styles.steps} aria-label="Import steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`${styles.step} ${i === activeIndex ? styles.stepActive : ''}`}
              aria-current={i === activeIndex ? 'step' : undefined}
            >
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>

        {error && <Notice tone="danger">{error}</Notice>}

        {step === 'browse' &&
          (presetsLoading ? (
            <Spinner message="Loading presets…" />
          ) : !presets?.length ? (
            <EmptyState title="No presets available" />
          ) : (
            <>
              <SearchInput
                label="Search presets"
                placeholder="Search presets"
                value={browseSearch}
                onChange={e => setBrowseSearch(e.target.value)}
              />
              <DataTable
                aria-label="Presets"
                columns={presetColumns}
                rows={filteredPresets ?? []}
                rowKey={p => p._id}
                onRowClick={handlePreview}
                empty={<EmptyState title="No presets match your search" />}
                mobile={{
                  title: p => p.name,
                  subtitle: p => `${p.itemCount} items`,
                  meta: p => [p.isSystem ? 'System' : 'Custom', p.description],
                }}
              />
            </>
          ))}

        {step === 'preview' &&
          (presetLoading ? (
            <Spinner message="Loading preset items…" />
          ) : selectedPreset ? (
            <>
              <Notice tone="info">
                <span className={styles.count}>{willImport}</span> will be imported,{' '}
                <span className={styles.count}>{willSkip}</span> already exist and will be skipped
              </Notice>
              <SearchInput
                label="Search items"
                placeholder="Search items"
                value={previewSearch}
                onChange={e => setPreviewSearch(e.target.value)}
              />
              <DataTable
                aria-label="Preset items"
                columns={previewColumns}
                rows={filteredPreviewItems ?? []}
                rowKey={item => item.code}
                empty={<EmptyState title="No items match your search" />}
                mobile={{
                  title: item => item.name,
                  subtitle: item => `${item.code} · ${item.category}`,
                  badge: item =>
                    existingCodes.has(item.code.toUpperCase()) ? (
                      <span className={styles.exists}>Already exists</span>
                    ) : null,
                }}
              />
              <div className={styles.actions}>
                <Button onClick={handleBack} disabled={importing}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importing}
                  disabled={willImport === 0}
                >
                  {`Import ${willImport} items`}
                </Button>
              </div>
            </>
          ) : null)}

        {step === 'result' && importResult && (
          <>
            <Notice tone="success">
              <span className={styles.count}>{importResult.imported}</span> items imported
              {importResult.skipped > 0 && (
                <span className={styles.skipped}>
                  {importResult.skipped} skipped (duplicate codes)
                </span>
              )}
            </Notice>
            <div className={styles.actions}>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
