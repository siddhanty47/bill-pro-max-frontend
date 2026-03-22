/**
 * Shared document number badge with read-only prefix and editable sequence input.
 * Used by both ChallanForm and BillForm.
 */
import type { UseFormRegisterReturn } from 'react-hook-form';
import styles from './DocumentNumberBadge.module.css';

interface DocumentNumberBadgeProps {
  label: string;
  prefix: string;
  isLoading: boolean;
  disabled: boolean;
  error?: string;
  variant?: 'delivery' | 'return' | 'bill';
  register: UseFormRegisterReturn;
}

export function DocumentNumberBadge({
  label,
  prefix,
  isLoading,
  disabled,
  error,
  variant,
  register,
}: DocumentNumberBadgeProps) {
  return (
    <div className={styles.badge}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${variant ? styles[variant] : ''}`}>
        {isLoading ? '...' : prefix}
      </span>
      <input
        type="number"
        min={1}
        max={9999}
        className={styles.sequenceInput}
        {...register}
        disabled={disabled}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}
