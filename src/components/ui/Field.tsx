import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type FieldsetHTMLAttributes,
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
  htmlFor?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  const autoId = useId();
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const childId = isValidElement<{ id?: string }>(only) ? only.props.id : undefined;
  const id = htmlFor ?? childId ?? autoId;

  const control =
    isValidElement<{ id?: string }>(only) && !only.props.id
      ? cloneElement(only as ReactElement<{ id?: string }>, { id })
      : children;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {control}
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

type ControlExtras = { mono?: boolean; invalid?: boolean };

function controlClass(className: string | undefined, mono?: boolean) {
  return [styles.control, mono ? styles.mono : '', className ?? ''].filter(Boolean).join(' ');
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & ControlExtras;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, invalid, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={controlClass(className, mono)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & ControlExtras;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { mono, invalid, className, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={controlClass(className, mono)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras;

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
