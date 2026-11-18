import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { DocumentNumberBadge } from './DocumentNumberBadge';

function Harness(props: {
  isLoading?: boolean;
  disabled?: boolean;
  error?: string;
  variant?: 'delivery' | 'return' | 'bill';
  onValue?: (v: number) => void;
}) {
  const { register, handleSubmit } = useForm<{ seq: number }>({ defaultValues: { seq: 7 } });
  return (
    <form onSubmit={handleSubmit(v => props.onValue?.(v.seq))}>
      <DocumentNumberBadge
        label="Bill #"
        prefix="B-2026-27-"
        isLoading={props.isLoading ?? false}
        disabled={props.disabled ?? false}
        error={props.error}
        variant={props.variant}
        register={register('seq', { valueAsNumber: true })}
      />
      <button type="submit">go</button>
    </form>
  );
}

describe('DocumentNumberBadge', () => {
  it('shows the prefix and a labelled, editable sequence', async () => {
    let value = 0;
    render(<Harness variant="bill" onValue={v => (value = v)} />);
    expect(screen.getByText('B-2026-27-')).toBeInTheDocument();
    const input = screen.getByLabelText('Bill #');
    expect(input).toHaveValue(7);
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '9999');
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(value).toBe(12);
  });

  it('shows an ellipsis while loading and disables the input', () => {
    render(<Harness isLoading disabled variant="delivery" />);
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.queryByText('B-2026-27-')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bill #')).toBeDisabled();
  });

  it('shows the error message', () => {
    render(<Harness error="Too big" variant="return" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too big');
    expect(screen.getByLabelText('Bill #')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders without a variant', () => {
    render(<Harness />);
    expect(screen.getByText('B-2026-27-')).toBeInTheDocument();
  });
});
