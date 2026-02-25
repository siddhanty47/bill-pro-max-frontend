/**
 * @fileoverview Shared detail page layout components
 * @description Provides a Jira-style detail view shell with breadcrumb navigation,
 * header with status badge, two-column layout (main + sidebar), and reusable
 * section/field sub-components for consistent entity detail pages. DetailField
 * supports an optional `editable` prop to enable Jira-style inline editing.
 */
import { Link } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EditableField } from './EditableField';
import styles from './DetailPageShell.module.css';

// ─── DetailPageShell ────────────────────────────────────────────────

interface DetailPageShellProps {
  /** Page title (entity name / number) */
  title: string;
  /** Optional subtitle shown below the title (e.g. entity code) */
  subtitle?: string;
  /** Status text shown as a badge next to the title */
  status?: string;
  /** CSS class name applied to the status badge (e.g. "status status-active") */
  statusClassName?: string;
  /** Path to navigate back to (e.g. "/inventory") */
  backTo: string;
  /** Label for the back link (e.g. "Inventory") */
  backLabel: string;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error object from RTK Query (rendered via ErrorMessage) */
  error?: unknown;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Action buttons rendered in the header (edit/delete for V2) */
  headerActions?: React.ReactNode;
  /** Sidebar content (right column) */
  sidebar?: React.ReactNode;
  /** Main content area (left column) */
  children?: React.ReactNode;
}

/**
 * Detail page wrapper providing breadcrumb, header, and two-column layout.
 *
 * Handles loading / error states automatically. When data is ready,
 * renders a header row with title + status badge, then a two-column
 * grid with `children` on the left and `sidebar` on the right.
 */
export function DetailPageShell({
  title,
  subtitle,
  status,
  statusClassName,
  backTo,
  backLabel,
  isLoading,
  error,
  onRetry,
  headerActions,
  sidebar,
  children,
}: DetailPageShellProps) {
  if (isLoading) {
    return <LoadingSpinner message={`Loading ${backLabel.toLowerCase()}...`} />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={onRetry} />;
  }

  return (
    <div>
      {/* Back navigation */}
      <div className={styles.backBar}>
        <Link to={backTo} className={styles.backLink}>
          <span className={styles.backArrow}>&larr;</span>
          Back to {backLabel}
        </Link>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {status && (
              <span className={statusClassName || 'status'}>{status}</span>
            )}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {headerActions && (
          <div className={styles.headerActions}>{headerActions}</div>
        )}
      </div>

      {/* Body: main + sidebar */}
      <div className={styles.body}>
        <div className={styles.main}>{children}</div>
        {sidebar && <div className={styles.sidebar}>{sidebar}</div>}
      </div>
    </div>
  );
}

// ─── DetailSection ──────────────────────────────────────────────────

interface DetailSectionProps {
  /** Section heading text */
  title: string;
  /** Optional action buttons rendered inline with the section title */
  headerActions?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
}

/**
 * Card-like section block with a title header and content body.
 * Used inside DetailPageShell to group related fields.
 * Supports optional `headerActions` for buttons like "+ Add Site".
 */
export function DetailSection({ title, headerActions, children }: DetailSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span>{title}</span>
        {headerActions && <div className={styles.sectionActions}>{headerActions}</div>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

// ─── DetailField ────────────────────────────────────────────────────

/**
 * Configuration object that makes a DetailField inline-editable.
 * When provided, the static value display is replaced with EditableField.
 */
interface EditableConfig {
  /** Raw (non-formatted) value used inside the input */
  rawValue: string | number | undefined;
  /** Input control type */
  inputType: 'text' | 'number' | 'select' | 'textarea' | 'date';
  /** Options for select-type inputs */
  options?: { value: string; label: string }[];
  /** Mutation callback; should call `.unwrap()` so errors propagate */
  onSave: (newValue: string | number) => Promise<void>;
  /** Whether a save is currently in-flight */
  isSaving?: boolean;
  /** Display suffix (e.g. " pcs") */
  suffix?: string;
  /** Display prefix (e.g. "₹") */
  prefix?: string;
  /** Custom renderer for specialised inputs like CodeAutocomplete */
  renderEditInput?: (props: {
    value: string | number;
    onChange: (val: string | number) => void;
    onSave: () => void;
    onCancel: () => void;
  }) => React.ReactNode;
}

interface DetailFieldProps {
  /** Field label */
  label: string;
  /** Field value — any renderable content */
  value?: React.ReactNode;
  /** Text shown when value is nullish or empty string (default: "-") */
  emptyText?: string;
  /** If provided, makes this field inline-editable (Jira-style) */
  editable?: EditableConfig;
}

/**
 * Horizontal label-value pair for displaying a single entity field.
 * When `editable` is provided, delegates rendering to EditableField for
 * inline-edit support. Otherwise renders a static read-only display.
 */
export function DetailField({ label, value, emptyText = '-', editable }: DetailFieldProps) {
  if (editable) {
    return (
      <EditableField
        label={label}
        value={editable.rawValue}
        displayValue={value}
        inputType={editable.inputType}
        options={editable.options}
        onSave={editable.onSave}
        isSaving={editable.isSaving}
        emptyText={emptyText}
        suffix={editable.suffix}
        prefix={editable.prefix}
        renderEditInput={editable.renderEditInput}
      />
    );
  }

  const isEmpty = value === undefined || value === null || value === '';

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {isEmpty ? (
        <span className={`${styles.fieldValue} ${styles.fieldEmpty}`}>{emptyText}</span>
      ) : (
        <span className={styles.fieldValue}>{value}</span>
      )}
    </div>
  );
}
