import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocNumber } from './DocNumber';

describe('DocNumber', () => {
  it('renders plain text without a link', () => {
    render(<DocNumber value="INV-0042" />);
    expect(screen.getByText('INV-0042')).toHaveClass('docno');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a link when to is given', () => {
    render(
      <MemoryRouter>
        <DocNumber value="INV-0042" to="/bills/42" />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'INV-0042' });
    expect(link).toHaveAttribute('href', '/bills/42');
    expect(link).toHaveClass('docno');
  });
});
