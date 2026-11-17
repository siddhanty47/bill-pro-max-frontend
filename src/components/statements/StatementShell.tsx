import type { ReactNode } from 'react';
import { Card } from '../ui';
import styles from './StatementPreview.module.css';

interface StatementShellProps {
  /** e.g. "Ledger statement" */
  title: string;
  partyName: string;
  /** Period / as-of line under the title. */
  period: ReactNode;
  children: ReactNode;
}

/** Header card plus the statement body (cards, tables, summary) stacked beneath it. */
export function StatementShell({ title, partyName, period, children }: StatementShellProps) {
  return (
    <div className={styles.stack}>
      <Card title={`${title} - ${partyName}`}>
        <p className={styles.period}>{period}</p>
      </Card>
      {children}
    </div>
  );
}

export function StatementSummary({ children }: { children: ReactNode }) {
  return <div className={styles.summaryGrid}>{children}</div>;
}
