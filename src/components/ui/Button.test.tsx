import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Button } from './Button';

describe('Button', () => {
  it('renders a link when given to', () => {
    render(
      <MemoryRouter>
        <Button to="/bills">Bills</Button>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Bills' })).toHaveAttribute('href', '/bills');
  });

  it('renders an anchor when given href', () => {
    render(<Button href="https://example.com">Docs</Button>);
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
  });

  it('defaults to type button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('applies the variant class', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('primary');
  });

  it('defaults to secondary and md', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('secondary');
    expect(button).toHaveClass('md');
  });

  it('renders an icon when given one', () => {
    const { container } = render(<Button icon="plus">Add</Button>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
