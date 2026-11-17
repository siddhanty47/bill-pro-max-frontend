/**
 * Shared document number field: read-only prefix chip plus an editable sequence input.
 * Used by both ChallanForm and BillForm.
 */
import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field, Input } from './ui';
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
  const inputId = useId();
  return (
    <Field label={label} htmlFor={inputId} error={error} className={styles.field}>
      <div className={styles.row}>
        <span className={`${styles.prefix} ${variant ? styles[variant] : ''}`}>
          {isLoading ? '...' : prefix}
        </span>
        <Input
          id={inputId}
          mono
          invalid={!!error}
          type="number"
          min={1}
          max={9999}
          className={styles.sequence}
          {...register}
          disabled={disabled}
        />
      </div>
    </Field>
  );
}
