/**
 * Error message component
 */
import { getErrorMessage } from '../api/baseApi';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const message = getErrorMessage(error);

  return (
    <div className={styles.errorBox}>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          Try Again
        </button>
      )}
    </div>
  );
}
