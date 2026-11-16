import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, LoadingSpinner } from './Spinner';
import { LoadingSpinner as LoadingSpinnerShim } from '../LoadingSpinner';

describe('Spinner', () => {
  it('shows the default message as a status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows a custom message', () => {
    render(<Spinner message="Fetching bills" />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching bills');
  });

  it('draws a decorative ring instead of text frames', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^Loading…$/);
    expect(status.querySelector('.ring')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the LoadingSpinner alias and legacy path', () => {
    expect(LoadingSpinner).toBe(Spinner);
    expect(LoadingSpinnerShim).toBe(Spinner);
  });
});
