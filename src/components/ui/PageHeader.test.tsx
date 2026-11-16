import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title, eyebrow and actions', () => {
    render(<PageHeader title="Dashboard" eyebrow="Overview" actions={<button>New</button>} />);
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('renders just the title', () => {
    render(<PageHeader title="Bills" />);
    expect(screen.getByRole('heading', { name: 'Bills' })).toBeInTheDocument();
  });
});
