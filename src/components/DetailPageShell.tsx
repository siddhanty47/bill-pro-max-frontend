/**
 * @fileoverview Detail page building blocks
 * @description `DetailPageShell` (back link, eyebrow, title + status chip, header
 * actions, optional tabs, main column + sidebar), `DetailSection` (a kit Card) and
 * `DetailField` (a label/value row, optionally inline-editable via EditableField).
 * Built on the ui kit; see the "Detail page" recipe in the frontend-design skill.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorMessage, Icon, PageHeader, Spinner, StatusChip, TabPanel, Tabs } from './ui';
import type { Tone } from './ui/status';
import { EditableField } from './EditableField';
import styles from './DetailPageShell.module.css';

// ─── DetailPageShell ────────────────────────────────────────────────

export interface DetailTab {
  id: string;
  label: string;
  /** Shown after the label (e.g. number of bills) */
  count?: number;
}

export interface DetailPageShellProps {
  /** Page title (entity name / number) */
  title: string;
  /** Entity type for the eyebrow line, e.g. "Party" → "Party · MEHT" */
  eyebrow?: string;
  /** Entity code appended to the eyebrow */
  code?: string;
  /** Lifecycle status, rendered once as a StatusChip beside the title */
  status?: string;
  /** Only for non-lifecycle statuses; lifecycle tones come from ui/status.ts */
  statusTone?: Tone;
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
  /** Header actions: at most one primary Button, ≤2 visible, the rest in a Menu */
  headerActions?: ReactNode;
  /** Sidebar content (right column; below the main column on phones) */
  sidebar?: ReactNode;
  /** Tabs under the header; `children` is the active tab's content */
  tabs?: DetailTab[];
  /** Active tab id (defaults to the first tab) */
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Unique per page; wires tabs to the panel (default "detail") */
  idPrefix?: string;
  /** Main column content */
  children?: ReactNode;
  /** @deprecated Use `eyebrow` + `code`. Shown as the eyebrow when neither is set. */
  subtitle?: string;
  /** @deprecated Ignored; the status renders as a StatusChip. */
  statusClassName?: string;
}

function eyebrowText(eyebrow?: string, code?: string, subtitle?: string) {
  if (eyebrow && code) return `${eyebrow} · ${code}`;
  return eyebrow ?? code ?? subtitle;
}

export function DetailPageShell({
  title,
  eyebrow,
  code,
  status,
  statusTone,
  backTo,
  backLabel,
  isLoading,
  error,
  onRetry,
  headerActions,
  sidebar,
  tabs,
  activeTab,
  onTabChange,
  idPrefix = 'detail',
  children,
  subtitle,
}: DetailPageShellProps) {
  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={onRetry} />;
  }

  const currentTab = activeTab ?? tabs?.[0]?.id;

  return (
    <div>
      <Link to={backTo} className={styles.back} aria-label={`Back to ${backLabel}`}>
        <Icon name="arrow-left" size={14} />
        {backLabel}
      </Link>

      <PageHeader
        title={title}
        eyebrow={eyebrowText(eyebrow, code, subtitle)}
        badge={status ? <StatusChip status={status} tone={statusTone} /> : undefined}
        actions={headerActions}
      />

      {tabs && currentTab && (
        <Tabs
          idPrefix={idPrefix}
          tabs={tabs}
          activeTab={currentTab}
          onChange={id => onTabChange?.(id)}
        />
      )}

      <div className={sidebar ? styles.body : undefined}>
        {tabs && currentTab ? (
          <TabPanel idPrefix={idPrefix} tabId={currentTab} className={styles.main}>
            {children}
          </TabPanel>
        ) : (
          <div className={styles.main}>{children}</div>
        )}
        {sidebar && <aside className={styles.sidebar}>{sidebar}</aside>}
      </div>
    </div>
  );
}

// ─── DetailSection ──────────────────────────────────────────────────

export interface DetailSectionProps {
  /** Card title (sentence case) */
  title: string;
  /** Count pill after the title */
  count?: number;
  /** Right of the title, e.g. an "Add site" Button */
  actions?: ReactNode;
  /** @deprecated Use `actions`. */
  headerActions?: ReactNode;
  /** Default true. Pass false when the body is a table. */
  padded?: boolean;
  children: ReactNode;
}

/** A detail-page section: a kit Card whose body fits DetailField rows. */
export function DetailSection({
  title,
  count,
  actions,
  headerActions,
  padded = true,
  children,
}: DetailSectionProps) {
  return (
    <Card title={title} count={count} actions={actions ?? headerActions} padded={false}>
      {padded ? <div className={styles.sectionBody}>{children}</div> : children}
    </Card>
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
  }) => ReactNode;
}

export interface DetailFieldProps {
  /** Field label (sentence case). Empty → the value spans the full row. */
  label: string;
  /** Field value — any renderable content */
  value?: ReactNode;
  /** Text shown when value is nullish or empty string (default: "Not added") */
  emptyText?: string;
  /** Monospace value: codes, phone, GST, amounts, quantities */
  mono?: boolean;
  /** If provided, makes this field inline-editable */
  editable?: EditableConfig;
}

const isEmptyValue = (value: ReactNode) => value === undefined || value === null || value === '';

/** A label/value row (`<dl>`). With `editable`, the value is an EditableField. */
export function DetailField({
  label,
  value,
  emptyText = 'Not added',
  mono = false,
  editable,
}: DetailFieldProps) {
  const isEmpty = isEmptyValue(value);

  const content = editable ? (
    <EditableField
      label={label}
      value={editable.rawValue}
      displayValue={isEmpty ? undefined : value}
      inputType={editable.inputType}
      options={editable.options}
      onSave={editable.onSave}
      isSaving={editable.isSaving}
      emptyText={emptyText}
      suffix={editable.suffix}
      prefix={editable.prefix}
      mono={mono}
      renderEditInput={editable.renderEditInput}
    />
  ) : isEmpty ? (
    <span className={styles.empty}>{emptyText}</span>
  ) : (
    value
  );

  const valueClass = [styles.value, mono && !editable ? `mono ${styles.monoValue}` : '']
    .filter(Boolean)
    .join(' ');

  if (!label) {
    return <div className={`${styles.field} ${styles.bare} ${valueClass}`}>{content}</div>;
  }

  return (
    <dl className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={valueClass}>{content}</dd>
    </dl>
  );
}
