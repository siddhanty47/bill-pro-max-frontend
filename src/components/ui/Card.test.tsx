import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders the title as a heading with a count', () => {
    render(
      <Card title="Overdue bills" count={5} countTone="danger">
        body
      </Card>
    );
    expect(screen.getByRole('heading', { name: /Overdue bills/, level: 2 })).toBeInTheDocument();
    expect(screen.getByText('5')).toHaveClass('danger');
  });

  it('renders no heading without a title', () => {
    render(<Card>body</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders the header for actions alone', () => {
    render(<Card actions={<button type="button">View all</button>}>body</Card>);
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
  });

  it('uses a neutral count by default and omits padding when not padded', () => {
    const { container } = render(
      <Card title="T" count={0} padded={false} className="extra">
        body
      </Card>
    );
    expect(screen.getByText('0')).toHaveClass('neutral');
    expect(screen.getByText('body')).not.toHaveClass('body');
    expect(container.firstChild).toHaveClass('extra');
  });

  it('pads the body by default', () => {
    render(<Card>body</Card>);
    expect(screen.getByText('body')).toHaveClass('body');
  });
});
