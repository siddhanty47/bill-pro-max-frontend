/**
 * @fileoverview Jira-style inline editable field component
 * @description Provides a click-to-edit pattern: displays a value in view mode
 * with a hover pencil icon, then transforms into an input on click. Supports
 * text, number, select, textarea, and date input types. Reuses the same HTML
 * input elements and styling patterns as the existing modal forms.
 */
import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import styles from './EditableField.module.css';

/**
 * Props passed to a custom edit-mode renderer via `renderEditInput`.
 */
interface RenderEditInputProps {
  value: string | number;
  onChange: (val: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
}

interface EditableFieldProps {
  /** Field label (rendered on the left) */
  label: string;
  /** Raw value used in edit mode and as the source of truth */
  value: string | number | undefined;
  /** Display override for view mode (e.g. "₹500" for a number 500) */
  displayValue?: React.ReactNode;
  /** Input type for the edit-mode control */
  inputType: 'text' | 'number' | 'select' | 'textarea' | 'date';
  /** Options for select-type inputs */
  options?: { value: string; label: string }[];
  /** Called with the new value when the user commits an edit */
  onSave: (newValue: string | number) => Promise<void>;
  /** Whether the field is currently being saved (shows spinner) */
  isSaving?: boolean;
  /** Text shown when value is nullish or empty string */
  emptyText?: string;
  /** Suffix for display (e.g. " pcs", " days") */
  suffix?: string;
  /** Prefix for display (e.g. "₹") */
  prefix?: string;
  /**
   * Optional custom render for edit mode. Replaces the default input element.
   * Use this for specialized components like CodeAutocomplete.
   */
  renderEditInput?: (props: RenderEditInputProps) => React.ReactNode;
}

/**
 * EditableField implements a Jira-style inline edit pattern.
 *
 * In **view mode**, the value is displayed with a hover pencil icon and a
 * light-blue background highlight. Clicking enters **edit mode**, which renders
 * the appropriate input (or a custom renderer) with save/cancel action buttons.
 *
 * Save is triggered by Enter (for non-textarea inputs), blur, or the checkmark
 * button. Cancel is triggered by Escape or the X button.
 */
export function EditableField({
  label,
  value,
  displayValue,
  inputType,
  options,
  onSave,
  isSaving = false,
  emptyText = '-',
  suffix,
  prefix,
  renderEditInput,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string | number>(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  /** Sync local edit value when the source value changes (e.g. after a successful mutation) */
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value ?? '');
    }
  }, [value, isEditing]);

  /** Auto-focus the input when entering edit mode */
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && inputType !== 'date') {
        inputRef.current.select();
      }
    }
  }, [isEditing, inputType]);

  const enterEditMode = useCallback(() => {
    if (isSaving) return;
    setEditValue(value ?? '');
    setError(null);
    setIsEditing(true);
  }, [isSaving, value]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(value ?? '');
    setError(null);
  }, [value]);

  const commitEdit = useCallback(async () => {
    const finalValue = inputType === 'number' ? Number(editValue) : editValue;

    if (finalValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setError(null);
      await onSave(finalValue);
      setIsEditing(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'data' in err
          ? ((err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Save failed')
          : 'Save failed';
      setError(message);
    }
  }, [editValue, inputType, onSave, value]);

  /** Keyboard handler for inputs (Enter saves, Escape cancels) */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === 'Enter' && inputType !== 'textarea') {
        e.preventDefault();
        commitEdit();
      }
    },
    [cancelEdit, commitEdit, inputType],
  );

  const handleInputChange = useCallback(
    (rawValue: string) => {
      setEditValue(inputType === 'number' ? rawValue : rawValue);
    },
    [inputType],
  );

  // ── Build displayed value text for view mode ──

  const isEmpty = value === undefined || value === null || value === '';
  let viewContent: React.ReactNode;

  if (displayValue !== undefined) {
    viewContent = displayValue;
  } else if (isEmpty) {
    viewContent = <span className={styles.valueEmpty}>{emptyText}</span>;
  } else {
    viewContent = `${prefix ?? ''}${value}${suffix ?? ''}`;
  }

  // ── View mode ──

  if (!isEditing) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.label}>{label}</span>
        <span
          className={styles.valueDisplay}
          onClick={enterEditMode}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              enterEditMode();
            }
          }}
        >
          {isSaving ? <span className={styles.spinner} /> : viewContent}
          <span className={styles.pencilIcon} aria-hidden="true">✎</span>
        </span>
      </div>
    );
  }

  // ── Edit mode ──

  const renderDefaultInput = () => {
    switch (inputType) {
      case 'select':
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={String(editValue)}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={String(editValue)}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        );

      default:
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={inputType}
            value={inputType === 'number' ? editValue : String(editValue)}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            step={inputType === 'number' ? 'any' : undefined}
          />
        );
    }
  };

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>{label}</span>
      <div className={styles.editContainer}>
        <div className={styles.editRow}>
          {renderEditInput ? (
            <div className={styles.customInputWrapper}>
              {renderEditInput({
                value: editValue,
                onChange: (val) => setEditValue(val),
                onSave: commitEdit,
                onCancel: cancelEdit,
              })}
            </div>
          ) : (
            renderDefaultInput()
          )}
          <div className={styles.editActions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.saveBtn}`}
              onClick={commitEdit}
              title="Save"
              disabled={isSaving}
            >
              {isSaving ? <span className={styles.spinner} /> : '✓'}
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.cancelBtn}`}
              onClick={cancelEdit}
              title="Cancel"
              disabled={isSaving}
            >
              ✕
            </button>
          </div>
        </div>
        {error && <span className={styles.editError}>{error}</span>}
      </div>
    </div>
  );
}
