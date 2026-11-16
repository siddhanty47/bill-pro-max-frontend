/**
 * Error message component
 */
import { getErrorMessage } from '../../api/baseApi';
import { Button } from './Button';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const message = getErrorMessage(error);

  return (
    <div className={styles.errorBox} role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
