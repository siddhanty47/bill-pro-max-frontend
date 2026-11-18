import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title and action', () => {
    render(<EmptyState title="No bills yet" action={<button>Create bill</button>} />);
    expect(screen.getByText('No bills yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create bill' })).toBeInTheDocument();
  });

  it('renders without an action', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
