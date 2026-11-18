/**
 * Loading indicator — an accent ring (CSS-only animation) plus a status message.
 */
import styles from './Spinner.module.css';

/**
 * `message=""` drops the visible line (when a heading beside it already says
 * what is loading); the status region is then named "Loading".
 */
export function Spinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className={styles.container} role="status" aria-label={message ? undefined : 'Loading'}>
      <div className={styles.ring} aria-hidden="true" />
      {message && <p>{message}</p>}
    </div>
  );
}
