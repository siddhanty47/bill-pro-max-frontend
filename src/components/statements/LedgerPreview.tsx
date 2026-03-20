import { Link } from 'react-router-dom';
import type { LedgerStatementData } from '../../types';
import styles from './StatementPreview.module.css';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface LedgerPreviewProps {
  data: LedgerStatementData;
}

export function LedgerPreview({ data }: LedgerPreviewProps) {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <p className={styles.previewTitle}>Ledger Statement - {data.party.name}</p>
        <p className={styles.previewSubtitle}>
          {formatDate(data.period.from)} to {formatDate(data.period.to)}
        </p>
      </div>

      {data.entries.length === 0 ? (
        <p className={styles.emptyMessage}>No transactions found for this period.</p>
      ) : (
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th className={styles.numericCell}>Debit</th>
              <th className={styles.numericCell}>Credit</th>
              <th className={styles.numericCell}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.balanceRow}>
              <td colSpan={5}>Opening Balance</td>
              <td className={styles.numericCell}>{formatAmount(data.openingBalance)}</td>
            </tr>
            {data.entries.map((entry, idx) => (
              <tr key={idx}>
                <td>{formatDate(entry.date)}</td>
                <td>{entry.description}</td>
                <td>
                  {entry.billId ? (
                    <Link to={`/bills/${entry.billId}`} className={styles.entityLink}>
                      {entry.reference}
                    </Link>
                  ) : (
                    entry.reference
                  )}
                </td>
                <td className={styles.numericCell}>{entry.debit > 0 ? formatAmount(entry.debit) : '-'}</td>
                <td className={styles.numericCell}>{entry.credit > 0 ? formatAmount(entry.credit) : '-'}</td>
                <td className={styles.numericCell}>{formatAmount(entry.balance)}</td>
              </tr>
            ))}
            <tr className={styles.totalsRow}>
              <td colSpan={3}>Totals</td>
              <td className={styles.numericCell}>{formatAmount(data.totalDebits)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totalCredits)}</td>
              <td className={styles.numericCell}></td>
            </tr>
            <tr className={styles.balanceRow}>
              <td colSpan={5}>Closing Balance</td>
              <td className={styles.numericCell}>{formatAmount(data.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
