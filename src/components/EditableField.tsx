/**
 * @fileoverview Inline editable value
 * @description Click-to-edit value for detail pages and table cells. View mode shows
 * the value with an "Edit" hint revealed on hover/focus; edit mode swaps in a kit
 * Input/Select/Textarea (or a custom renderer) with Save and Cancel buttons.
 * Enter saves (except in textareas), Escape cancels, blur saves for inputs/selects.
 *
 * The row layout (label column) belongs to `DetailField`; `label` here names the
 * edit control for assistive tech.
 */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Button, Input, Select, Textarea } from './ui';
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

export interface EditableFieldProps {
  /** Field label: the accessible name of the edit control */
  label: string;
  /** Raw value used in edit mode and as the source of truth */
  value: string | number | undefined;
  /** Display override for view mode (e.g. "₹500" for a number 500) */
  displayValue?: ReactNode;
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
  /** Monospace value and input (codes, phone, GST, amounts, quantities) */
  mono?: boolean;
  /**
   * Optional custom render for edit mode. Replaces the default input element.
   * Use this for specialized components like CodeAutocomplete.
   */
  renderEditInput?: (props: RenderEditInputProps) => ReactNode;
  /** Compact spacing for table cells */
  compact?: boolean;
}

const errorMessage = (err: unknown) =>
  err && typeof err === 'object' && 'data' in err
    ? ((err as { data?: { error?: { message?: string } } }).data?.error?.message ?? 'Save failed')
    : 'Save failed';

/** Keeps focus (and so the blur-save) on the input when an action button is pressed. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

export function EditableField({
  label,
  value,
  displayValue,
  inputType,
  options,
  onSave,
  isSaving = false,
  emptyText = 'Not added',
  suffix,
  prefix,
  mono = false,
  renderEditInput,
  compact = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string | number>(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  /** Guards against a second save (e.g. blur then Save click) while one is in flight. */
  const committingRef = useRef(false);

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
    if (committingRef.current) return;
    const finalValue = inputType === 'number' ? Number(editValue) : editValue;

    if (finalValue === value) {
      setIsEditing(false);
      return;
    }

    committingRef.current = true;
    try {
      setError(null);
      await onSave(finalValue);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      committingRef.current = false;
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
    [cancelEdit, commitEdit, inputType]
  );

  const containerClass = [styles.root, compact ? styles.compact : ''].filter(Boolean).join(' ');

  // ── View mode ──

  if (!isEditing) {
    const isEmpty = value === undefined || value === null || value === '';
    let viewContent: ReactNode;
    if (displayValue !== undefined) {
      viewContent = displayValue;
    } else if (isEmpty) {
      viewContent = <span className={styles.empty}>{emptyText}</span>;
    } else {
      viewContent = `${prefix ?? ''}${value}${suffix ?? ''}`;
    }

    return (
      <span
        className={[containerClass, styles.trigger, mono ? 'mono' : ''].filter(Boolean).join(' ')}
        onClick={enterEditMode}
        role="button"
        tabIndex={0}
        aria-busy={isSaving || undefined}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            enterEditMode();
          }
        }}
      >
        <span className={styles.value}>
          {isSaving ? <span className={styles.spinner} aria-hidden="true" /> : viewContent}
        </span>
        <span className={styles.hint}>Edit</span>
      </span>
    );
  }

  // ── Edit mode ──

  const controlProps = {
    'aria-label': label || undefined,
    value: String(editValue),
    onKeyDown: handleKeyDown,
    invalid: !!error,
    mono,
  };

  const renderDefaultInput = () => {
    switch (inputType) {
      case 'select':
        return (
          <Select
            {...controlProps}
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
          >
            {options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            {...controlProps}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            onChange={e => setEditValue(e.target.value)}
          />
        );

      default:
        return (
          <Input
            {...controlProps}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={inputType}
            value={inputType === 'number' ? editValue : String(editValue)}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            step={inputType === 'number' ? 'any' : undefined}
          />
        );
    }
  };

  return (
    <div className={`${containerClass} ${styles.editor}`}>
      {renderEditInput ? (
        <div className={styles.custom}>
          {renderEditInput({
            value: editValue,
            onChange: val => setEditValue(val),
            onSave: commitEdit,
            onCancel: cancelEdit,
          })}
        </div>
      ) : (
        renderDefaultInput()
      )}
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="primary"
          onMouseDown={keepFocus}
          onClick={commitEdit}
          loading={isSaving}
        >
          Save
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={cancelEdit} disabled={isSaving}>
          Cancel
        </Button>
      </div>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
