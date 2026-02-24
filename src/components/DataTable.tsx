/**
 * Generic data table component
 */
import styles from './DataTable.module.css';

interface Column {
  key: string;
  header: string;
  render?: (item: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: Column[];
  keyField: string;
  onRowClick?: (item: Record<string, unknown>) => void;
  emptyMessage?: string;
}

export function DataTable({
  data,
  columns,
  keyField,
  onRowClick,
  emptyMessage = 'No data found',
}: DataTableProps) {
  if (data.length === 0) {
    return <div className={styles.emptyState}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.tableContainer}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={String(item[keyField])}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'clickable' : ''}
            >
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render
                    ? col.render(item)
                    : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
