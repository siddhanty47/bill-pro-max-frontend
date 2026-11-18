import type { ReactNode } from 'react';
import { Card, Notice } from '../ui';
import styles from './StatementPreview.module.css';

interface StatementShellProps {
  /** e.g. "Ledger statement" */
  title: string;
  partyName: string;
  /** Period / as-of line under the title. */
  period: string;
  /** Rendered inside the statement card (usually its table). */
  body?: ReactNode;
  /** Shown instead of the body when the period has nothing. */
  emptyMessage?: string;
  /** Rendered below the card (extra cards, summaries). */
  children?: ReactNode;
}

/** One card per statement: title, period, then the table; summaries sit beneath it. */
export function StatementShell({
  title,
  partyName,
  period,
  body,
  emptyMessage,
  children,
}: StatementShellProps) {
  return (
    <div className={styles.stack}>
      <Card title={`${title} · ${partyName}`} subtitle={period} padded={false}>
        {emptyMessage ? (
          <div className={styles.notice}>
            <Notice tone="info">{emptyMessage}</Notice>
          </div>
        ) : (
          body
        )}
      </Card>
      {!emptyMessage && children}
    </div>
  );
}

export function StatementSummary({ children }: { children: ReactNode }) {
  return <div className={styles.summaryGrid}>{children}</div>;
}
