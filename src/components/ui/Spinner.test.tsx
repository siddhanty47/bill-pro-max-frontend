import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Spinner, LoadingSpinner } from './Spinner';
import { LoadingSpinner as LoadingSpinnerShim } from '../LoadingSpinner';

describe('Spinner', () => {
  it('shows the default message as a status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  it('shows a custom message', () => {
    render(<Spinner message="Fetching bills" />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching bills');
  });

  it('keeps animating frames without changing the message', () => {
    vi.useFakeTimers();
    render(<Spinner />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    vi.useRealTimers();
  });

  it('keeps the LoadingSpinner alias and legacy path', () => {
    expect(LoadingSpinner).toBe(Spinner);
    expect(LoadingSpinnerShim).toBe(Spinner);
  });
});
