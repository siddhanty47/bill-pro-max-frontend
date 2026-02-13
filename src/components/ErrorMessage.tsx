/**
 * Error message component
 */
import { getErrorMessage } from '../api/baseApi';

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const message = getErrorMessage(error);

  return (
    <div className="error-box">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          Try Again
        </button>
      )}
    </div>
  );
}
