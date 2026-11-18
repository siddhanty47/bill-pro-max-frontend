import { forwardRef, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';
import styles from './SearchInput.module.css';

/** `className` goes on the wrapper (placement only); other props go to the input. */
export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Accessible name (there is no visible label). */
  label: string;
  /** Keyboard-shortcut hint at the right, e.g. "/" (hidden at ≤768). Wire the key with `useHotkey`. */
  hint?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { label, hint, className, ...rest },
  ref
) {
  return (
    <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={15} />
      </span>
      <input ref={ref} type="search" aria-label={label} className={styles.input} {...rest} />
      {hint && (
        <kbd className={styles.hint} aria-hidden="true">
          {hint}
        </kbd>
      )}
    </div>
  );
});
