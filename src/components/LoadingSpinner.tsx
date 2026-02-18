/**
 * Loading spinner component
 */
import styles from './LoadingSpinner.module.css';

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}></div>
      <p>{message}</p>
    </div>
  );
}
