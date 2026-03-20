import { Link } from 'react-router-dom';
import type { BillStatementData } from '../../types';
import styles from './StatementPreview.module.css';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BillsPreviewProps {
  data: BillStatementData;
}

export function BillsPreview({ data }: BillsPreviewProps) {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <p className={styles.previewTitle}>Bill Statement - {data.party.name}</p>
        <p className={styles.previewSubtitle}>
          {formatDate(data.period.from)} to {formatDate(data.period.to)}
          {data.siteCode && ` | Site: ${data.siteCode}`}
        </p>
      </div>

      {data.bills.length === 0 ? (
        <p className={styles.emptyMessage}>No bills found for this period.</p>
      ) : (
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Date</th>
              <th>Site</th>
              <th>Period</th>
              <th className={styles.numericCell}>Rent</th>
              <th className={styles.numericCell}>Transport</th>
              <th className={styles.numericCell}>Damage</th>
              <th className={styles.numericCell}>Subtotal</th>
              <th className={styles.numericCell}>Tax</th>
              <th className={styles.numericCell}>Discount</th>
              <th className={styles.numericCell}>Total</th>
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
                <td>{bill.siteCode || '-'}</td>
                <td>
                  {bill.periodStart && bill.periodEnd
                    ? `${formatDate(bill.periodStart)} - ${formatDate(bill.periodEnd)}`
                    : '-'}
                </td>
                <td className={styles.numericCell}>{formatAmount(bill.rentCharges)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.transportationCharges)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.damageCharges)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.subtotal)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.taxAmount)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.discountAmount)}</td>
                <td className={styles.numericCell}>{formatAmount(bill.totalAmount)}</td>
              </tr>
            ))}
            <tr className={styles.totalsRow}>
              <td colSpan={4}>Totals ({data.totals.billCount} bills)</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.rentCharges)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.transportationCharges)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.damageCharges)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.subtotal)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.taxAmount)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.discountAmount)}</td>
              <td className={styles.numericCell}>{formatAmount(data.totals.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
