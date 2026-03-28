/**
 * Shared Change History Table component
 * Displays Jira-style audit history for any document type
 */
import { useState } from 'react';
import { useGetAuditHistoryQuery } from '../api/auditLogApi';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import type { AuditFieldChange } from '../types';
import styles from './ChangeHistoryTable.module.css';

interface ChangeHistoryTableProps {
  documentType: string;
  documentId: string;
}

const PAGE_SIZE = 15;

/**
 * Format a date string as relative time (e.g. "2 hours ago")
 */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return new Date(dateStr).toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format a full date for tooltip
 */
function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

/**
 * Convert a camelCase or dot-notation field name to a human-readable label
 */
function humanizeField(field: string): string {
  return field
    .replace(/\./g, ' > ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Format a value for display
 */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'empty';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'string') {
    // Try to detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      return new Date(val).toLocaleDateString();
    }
    return val || 'empty';
  }
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * Get CSS class for action badge
 */
function actionBadgeClass(action: string): string {
  switch (action) {
    case 'created':
      return 'status status-active';
    case 'updated':
      return 'status status-draft';
    case 'deleted':
      return 'status status-cancelled';
    default:
      return 'status';
  }
}

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

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  if (!data || data.data.length === 0) {
    return <p className="text-empty">No change history available.</p>;
  }

  const { pagination } = data;

  return (
    <div className={styles.wrap}>
      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((entry) => (
            <tr key={entry._id}>
              <td className="text-nowrap" title={formatFullDate(entry.createdAt)}>
                {timeAgo(entry.createdAt)}
              </td>
              <td className="text-nowrap">{entry.performedBy.name}</td>
              <td>
                <span className={actionBadgeClass(entry.action)}>
                  {entry.action}
                </span>
              </td>
              <td>
                {entry.action === 'created' && (
                  <span className={styles.summaryText}>Document created</span>
                )}
                {entry.action === 'deleted' && (
                  <span className={styles.summaryText}>Document deleted</span>
                )}
                {entry.action === 'updated' && entry.changes.length > 0 && (
                  <div className={styles.changesList}>
                    {entry.changes.map((change: AuditFieldChange, i: number) => (
                      <div key={i} className={styles.changeRow}>
                        <span className={styles.fieldName}>{humanizeField(change.field)}</span>
                        <span className={styles.oldValue}>{formatValue(change.oldValue)}</span>
                        <span className={styles.arrow}>&rarr;</span>
                        <span className={styles.newValue}>{formatValue(change.newValue)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {entry.action === 'updated' && entry.changes.length === 0 && (
                  <span className={styles.summaryText}>Document updated</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className="btn btn-secondary"
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
