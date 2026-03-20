import { Link } from 'react-router-dom';
import type { AgingStatementData } from '../../types';
import styles from './StatementPreview.module.css';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface AgingPreviewProps {
  data: AgingStatementData;
}

export function AgingPreview({ data }: AgingPreviewProps) {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <p className={styles.previewTitle}>Aging Statement - {data.party.name}</p>
        <p className={styles.previewSubtitle}>As of {formatDate(data.asOfDate)}</p>
      </div>

      {data.bills.length === 0 ? (
        <p className={styles.emptyMessage}>No outstanding bills found.</p>
      ) : (
        <>
          <table className={styles.previewTable}>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Bill Date</th>
                <th>Due Date</th>
                <th className={styles.numericCell}>Days Overdue</th>
                <th className={styles.numericCell}>Total</th>
                <th className={styles.numericCell}>Paid</th>
                <th className={styles.numericCell}>Balance Due</th>
                <th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((bill) => (
                <tr key={bill.billId}>
                  <td>
                    <Link to={`/bills/${bill.billId}`} className={styles.entityLink}>
                      {bill.billNumber}
                    </Link>
                  </td>
                  <td>{formatDate(bill.billDate)}</td>
                  <td>{formatDate(bill.dueDate)}</td>
                  <td className={styles.numericCell}>{bill.daysOverdue}</td>
                  <td className={styles.numericCell}>{formatAmount(bill.totalAmount)}</td>
                  <td className={styles.numericCell}>{formatAmount(bill.amountPaid)}</td>
                  <td className={styles.numericCell}>{formatAmount(bill.balanceDue)}</td>
                  <td>{bill.bucket}</td>
                </tr>
              ))}
              <tr className={styles.totalsRow}>
                <td colSpan={6}>Grand Total</td>
                <td className={styles.numericCell}>{formatAmount(data.grandTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Current (0-30)</span>
              <span className={styles.summaryValue}>{formatAmount(data.buckets.current)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>31-60 Days</span>
              <span className={styles.summaryValue}>{formatAmount(data.buckets.days31_60)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>61-90 Days</span>
              <span className={styles.summaryValue}>{formatAmount(data.buckets.days61_90)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>90+ Days</span>
              <span className={styles.summaryValue}>{formatAmount(data.buckets.days90Plus)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
