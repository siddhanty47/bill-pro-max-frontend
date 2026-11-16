import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type FieldsetHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.css';

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  /** Rendered right-aligned on the label row, outside the <label> (e.g. a "Forgot?" link). */
  labelAction?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children: ReactNode };

type ControlProps = {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true';
  'aria-required'?: boolean | 'true';
};

function isControl(node: unknown): node is ReactElement<ControlProps> {
  if (!isValidElement(node)) return false;
  const t = node.type;
  return (
    t === Input ||
    t === Select ||
    t === Textarea ||
    t === Checkbox ||
    t === 'input' ||
    t === 'select' ||
    t === 'textarea'
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  labelAction,
  className,
  children,
  ...rest
}: FieldProps) {
  const autoId = useId();
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const control = isControl(only) ? only : null;
  const id = htmlFor ?? control?.props.id ?? (control ? autoId : undefined);
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = error ? `${autoId}-error` : undefined;

  let content: ReactNode = children;
  if (control) {
    const describedBy =
      [control.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
    content = cloneElement(control, {
      id: control.props.id ?? id,
      'aria-describedby': describedBy,
      ...(error ? { 'aria-invalid': 'true' as const } : {}),
      ...(required ? { required: true, 'aria-required': 'true' as const } : {}),
    });
  }

  const labelEl = (
    <label htmlFor={id} className={styles.label}>
      {label}
      {required && (
        <span className={styles.required} aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );

  return (
    <div className={[styles.field, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {labelAction ? (
        <div className={styles.labelRow}>
          {labelEl}
          <span className={styles.labelAction}>{labelAction}</span>
        </div>
      ) : (
        labelEl
      )}
      {content}
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

/** `lg`: 44px tall, 15px text (auth forms). Replaces the native numeric `size` attribute. */
export type ControlSize = 'md' | 'lg';

type ControlExtras = { mono?: boolean; invalid?: boolean; size?: ControlSize };

function controlClass(className: string | undefined, mono?: boolean, size?: ControlSize) {
  return [styles.control, mono ? styles.mono : '', size === 'lg' ? styles.lg : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & ControlExtras;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, invalid, size, className, ...rest },
  ref
) {
  const boxless = rest.type === 'checkbox' || rest.type === 'radio';
  const base = boxless
    ? [styles.check, className ?? ''].filter(Boolean).join(' ')
    : controlClass(className, mono, size);
  return <input ref={ref} className={base} aria-invalid={invalid || undefined} {...rest} />;
});

export type CheckboxProps = { label?: ReactNode } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className={styles.checkRow}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={[styles.check, className ?? ''].filter(Boolean).join(' ')}
        {...rest}
      />
      {label && (
        <label htmlFor={inputId} className={styles.checkLabel}>
          {label}
        </label>
      )}
    </span>
  );
});

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & ControlExtras;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { mono, invalid, size, className, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={`${controlClass(className, mono, size)} ${styles.select}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  Omit<ControlExtras, 'size'>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { mono, invalid, className, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={`${controlClass(className, mono)} ${styles.textarea}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export type FieldsetProps = { legend: ReactNode } & FieldsetHTMLAttributes<HTMLFieldSetElement>;

export function Fieldset({ legend, className, children, ...rest }: FieldsetProps) {
  return (
    <fieldset className={[styles.fieldset, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <legend className={styles.legend}>{legend}</legend>
      {children}
    </fieldset>
  );
}
