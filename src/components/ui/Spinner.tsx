/**
 * Loading indicator — an accent ring (CSS-only animation) plus a status message.
 */
import styles from './Spinner.module.css';

export function Spinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className={styles.container} role="status">
      <div className={styles.ring} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

/** Legacy name kept for existing call sites. */
export const LoadingSpinner = Spinner;
