/**
 * Loading spinner component
 */
export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
}
