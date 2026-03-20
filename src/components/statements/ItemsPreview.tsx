import { Link } from 'react-router-dom';
import type { ItemStatementData } from '../../types';
import styles from './StatementPreview.module.css';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

interface ItemsPreviewProps {
  data: ItemStatementData;
}

export function ItemsPreview({ data }: ItemsPreviewProps) {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <p className={styles.previewTitle}>Item Statement - {data.party.name}</p>
        <p className={styles.previewSubtitle}>
          {formatDate(data.period.from)} to {formatDate(data.period.to)}
        </p>
      </div>

      {data.items.length === 0 ? (
        <p className={styles.emptyMessage}>No item activity found for this period.</p>
      ) : (
        <>
          {data.items.map((item) => (
            <div key={item.itemId}>
              <h4 className={styles.sectionHeader}>{item.itemName}</h4>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Challan #</th>
                    <th className={styles.numericCell}>Delivery Qty</th>
                    <th className={styles.numericCell}>Return Qty</th>
                    <th className={styles.numericCell}>Running Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.balanceRow}>
                    <td colSpan={4}>Opening Qty</td>
                    <td className={styles.numericCell}>{item.openingQty}</td>
                  </tr>
                  {item.events.map((event, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(event.date)}</td>
                      <td>
                        <Link to={`/challans/${event.challanId}`} className={styles.entityLink}>
                          {event.challanNumber}
                        </Link>
                      </td>
                      <td className={styles.numericCell}>{event.type === 'delivery' ? event.quantity : '-'}</td>
                      <td className={styles.numericCell}>{event.type === 'return' ? event.quantity : '-'}</td>
                      <td className={styles.numericCell}>{event.runningQty}</td>
                    </tr>
                  ))}
                  <tr className={styles.balanceRow}>
                    <td colSpan={4}>Closing Qty</td>
                    <td className={styles.numericCell}>{item.closingQty}</td>
                  </tr>
                  <tr className={styles.totalsRow}>
                    <td colSpan={2}>Summary</td>
                    <td className={styles.numericCell}>{item.totalDelivered}</td>
                    <td className={styles.numericCell}>{item.totalReturned}</td>
                    <td className={styles.numericCell}>
                      Dmg: {item.damages.damaged} | Short: {item.damages.short}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Delivered</span>
              <span className={styles.summaryValue}>{data.grandTotals.totalDelivered}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Returned</span>
              <span className={styles.summaryValue}>{data.grandTotals.totalReturned}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Net Held</span>
              <span className={styles.summaryValue}>{data.grandTotals.netHeld}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Damaged</span>
              <span className={styles.summaryValue}>{data.grandTotals.totalDamaged}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Short</span>
              <span className={styles.summaryValue}>{data.grandTotals.totalShort}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
