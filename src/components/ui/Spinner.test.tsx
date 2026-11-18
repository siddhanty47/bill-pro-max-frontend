import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

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

  it('drops the visible message when given an empty one', () => {
    const { container } = render(<Spinner message="" />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
  });
});
