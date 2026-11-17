import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('shows the error message as an alert', () => {
    render(<ErrorMessage error={{ data: { error: { message: 'Boom' } } }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('hides retry without onRetry', () => {
    render(<ErrorMessage error={new Error('x')} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry from the retry button', async () => {
    const onRetry = vi.fn();
    render(<ErrorMessage error={new Error('x')} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
