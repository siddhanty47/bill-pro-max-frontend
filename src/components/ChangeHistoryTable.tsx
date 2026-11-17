/**
 * Shared Change History Table component
 * Displays Jira-style audit history for any document type
 */
import { useState } from 'react';
import { useGetAuditHistoryQuery } from '../api/auditLogApi';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { Button, Card, DataTable, EmptyState, ErrorMessage, Spinner, StatusChip } from './ui';
import type { Column } from './ui';
import { statusLabel } from './ui/status';
import { formatDate, formatDateTime } from '../utils/format';
import type { AuditFieldChange, AuditLogEntry } from '../types';
import styles from './ChangeHistoryTable.module.css';

interface ChangeHistoryTableProps {
  documentType: string;
  documentId: string;
}

const PAGE_SIZE = 15;

/** Date plus time, e.g. "17 Nov, 3:45 pm" — the time matters for audit entries. */
/**
 * Convert a camelCase or dot-notation field name to a human-readable label
 */
function humanizeField(field: string): string {
  return field
    .replace(/\./g, ' > ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase());
}

type Shown = { text: string; empty: boolean; numeric: boolean };

/** Format a value for display; empty values show as "Not set". */
function formatValue(val: unknown): Shown {
  const empty = { text: 'Not set', empty: true, numeric: false };
  if (val === null || val === undefined || val === '') return empty;
  if (typeof val === 'boolean') return { text: val ? 'Yes' : 'No', empty: false, numeric: false };
  if (typeof val === 'number') return { text: String(val), empty: false, numeric: true };
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      return { text: formatDate(val), empty: false, numeric: false };
    }
    return { text: val, empty: false, numeric: false };
  }
  if (Array.isArray(val)) return { text: `${val.length} items`, empty: false, numeric: false };
  return { text: JSON.stringify(val), empty: false, numeric: false };
}

const WORD_FIELDS = new Set(['status', 'type']);

function Value({ val, field, className }: { val: unknown; field: string; className: string }) {
  const shown = formatValue(val);
  const { empty, numeric } = shown;
  const plainWord = typeof val === 'string' && /^[a-z_-]+$/i.test(val);
  const text =
    WORD_FIELDS.has(field.toLowerCase()) && plainWord ? statusLabel(val as string) : shown.text;
  const cls = [empty ? styles.notSet : className, numeric ? styles.num : ''].filter(Boolean);
  return <span className={cls.join(' ')}>{text}</span>;
}

function summaryOf(entry: AuditLogEntry): string {
  if (entry.action === 'created') return 'Document created';
  if (entry.action === 'deleted') return 'Document deleted';
  if (entry.changes.length === 0) return 'Document updated';
  return entry.changes.map(c => humanizeField(c.field)).join(', ');
}

function Changes({ entry }: { entry: AuditLogEntry }) {
  if (entry.action !== 'updated' || entry.changes.length === 0) {
    return <span className={styles.summary}>{summaryOf(entry)}</span>;
  }
  return (
    <span className={styles.changes}>
      {entry.changes.map((change: AuditFieldChange, i: number) => (
        <span key={i} className={styles.change}>
          <span className={styles.field}>{humanizeField(change.field)}</span>
          <Value val={change.oldValue} field={change.field} className={styles.old} />
          <span className={styles.arrow} aria-hidden="true">
            &rarr;
          </span>
          <Value val={change.newValue} field={change.field} className={styles.new} />
        </span>
      ))}
    </span>
  );
}

const COLUMNS: Column<AuditLogEntry>[] = [
  {
    key: 'when',
    header: 'When',
    nowrap: true,
    render: e => (
      <span title={new Date(e.createdAt).toLocaleString()}>{formatDateTime(e.createdAt)}</span>
    ),
  },
  { key: 'who', header: 'Who', nowrap: true, render: e => e.performedBy.name },
  { key: 'action', header: 'Action', render: e => <StatusChip status={e.action} /> },
  { key: 'changes', header: 'Changes', render: e => <Changes entry={e} /> },
];

export default function ChangeHistoryTable({ documentType, documentId }: ChangeHistoryTableProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useGetAuditHistoryQuery(
    {
      businessId: currentBusinessId!,
      documentType,
      documentId,
      page,
      pageSize: PAGE_SIZE,
    },
    { skip: !currentBusinessId }
  );

  if (isLoading)
    return (
      <Card padded={false}>
        <Spinner />
      </Card>
    );
  if (error)
    return (
      <Card padded={false}>
        <ErrorMessage error={error} onRetry={refetch} />
      </Card>
    );
  if (!data || data.data.length === 0)
    return (
      <Card padded={false}>
        <EmptyState title="No changes yet" />
      </Card>
    );

  const { pagination } = data;

  return (
    <Card padded={false}>
      <DataTable
        aria-label="Change history"
        columns={COLUMNS}
        rows={data.data}
        rowKey={e => e._id}
        mobile={{
          title: e => summaryOf(e),
          badge: e => <StatusChip status={e.action} />,
          subtitle: e =>
            e.action === 'updated' && e.changes.length > 0 ? <Changes entry={e} /> : null,
          meta: e => [e.performedBy.name, formatDateTime(e.createdAt)],
        }}
      />

      {pagination.totalPages > 1 && (
        <div className={styles.pager}>
          <Button disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
