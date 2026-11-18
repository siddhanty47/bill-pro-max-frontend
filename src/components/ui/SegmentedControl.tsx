import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

export type SegmentedDot = 'info' | 'warning' | 'success' | 'danger';

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  /** Small status-tone dot before the label (e.g. delivery = info, return = warning). */
  dot?: SegmentedDot;
};

export type SegmentedControlProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group, e.g. "Type". */
  label: string;
};

const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** A single-choice filter (radio group). Arrow keys move and select; only the checked option is tabbable. */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    onChange(options[index].value);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number;
    if (e.key in NEXT) target = (index + NEXT[e.key] + options.length) % options.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = options.length - 1;
    else return;
    e.preventDefault();
    select(target);
  };

  return (
    <div className={styles.seg} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={[styles.option, checked ? styles.on : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(o.value)}
            onKeyDown={e => handleKeyDown(e, i)}
          >
            {o.dot && (
              <span className={`${styles.dot} ${styles[`dot-${o.dot}`]}`} aria-hidden="true" />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
