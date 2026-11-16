import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

  it('keeps the label in the DOM while loading so width is stable', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('passes onClick and aria attributes through to a link', async () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <Button to="/x" onClick={onClick as never} aria-label="Go there" data-track="x">
          Go
        </Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Go there' });
    expect(link).toHaveAttribute('data-track', 'x');
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes the accessible name while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('does not navigate or call onClick for a disabled to link', async () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <Button to="/next" disabled onClick={onClick as never}>
                Go
              </Button>
            }
          />
          <Route path="/next" element={<p>Arrived</p>} />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    await userEvent.click(link, { pointerEventsCheck: 0 });
    expect(screen.queryByText('Arrived')).not.toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('marks a loading to link busy and inert', () => {
    render(
      <MemoryRouter>
        <Button to="/next" loading>
          Go
        </Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('aria-busy', 'true');
  });

  it('does not call onClick for a disabled href anchor', async () => {
    const onClick = vi.fn();
    render(
      <Button href="https://example.com" disabled onClick={onClick as never}>
        Docs
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(link, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });
});
