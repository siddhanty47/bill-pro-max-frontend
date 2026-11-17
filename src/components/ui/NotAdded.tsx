import styles from './NotAdded.module.css';

/**
 * The muted "Not added" placeholder for an empty value: a table cell, a custom
 * row, an empty `DetailField`. Always the text font, even inside a mono cell.
 */
export function NotAdded({ children = 'Not added' }: { children?: string }) {
  return <span className={styles.notAdded}>{children}</span>;
}
