import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title, subtitle and actions', () => {
    render(<PageHeader title="Dashboard" subtitle="Overview" actions={<button>New</button>} />);
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    const subtitle = screen.getByText('Overview');
    expect(subtitle.tagName).toBe('P');
    // Subtitle sits under the title, not above it.
    expect(
      screen.getByRole('heading', { name: 'Dashboard' }).compareDocumentPosition(subtitle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('renders just the title, with no context line', () => {
    const { container } = render(<PageHeader title="Bills" />);
    expect(screen.getByRole('heading', { name: 'Bills' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders a badge next to the title', () => {
    render(<PageHeader title="Mehta Builders" badge={<span>Active</span>} />);
    const heading = screen.getByRole('heading', { name: 'Mehta Builders' });
    expect(heading.parentElement).toHaveTextContent('Active');
  });
});
