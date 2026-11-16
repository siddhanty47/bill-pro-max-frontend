import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Notice } from './Notice';

describe('Notice', () => {
  it('announces danger as an alert', () => {
    render(<Notice tone="danger">Invalid login</Notice>);
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Invalid login');
    expect(notice).toHaveClass('notice', 'danger');
  });

  it.each(['success', 'info', 'warning'] as const)('announces %s as a status', tone => {
    render(<Notice tone={tone}>Saved</Notice>);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Saved');
    expect(notice).toHaveClass(tone);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an optional title and merges className', () => {
    render(
      <Notice tone="info" title="Heads up" className="placed">
        Body
      </Notice>
    );
    const notice = screen.getByRole('status');
    expect(screen.getByText('Heads up')).toHaveClass('title');
    expect(notice).toHaveClass('placed');
  });

  it('omits the title by default', () => {
    const { container } = render(<Notice tone="info">Body</Notice>);
    expect(container.querySelector('.title')).toBeNull();
  });
});
