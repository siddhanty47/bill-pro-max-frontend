import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is named by its label', () => {
    render(<IconButton label="Notifications" icon="bell" />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows a badge dot when badge', () => {
    const { container } = render(<IconButton label="Notifications" icon="bell" badge />);
    expect(container.querySelector('.badge')).toBeInTheDocument();
  });

  it('omits the badge dot by default', () => {
    const { container } = render(<IconButton label="Notifications" icon="bell" />);
    expect(container.querySelector('.badge')).not.toBeInTheDocument();
  });

  it('tints a danger tone', () => {
    render(<IconButton label="Stop" icon="stop" tone="danger" />);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('data-tone', 'danger');
  });

  it('has no tone by default', () => {
    render(<IconButton label="Mic" icon="mic" />);
    expect(screen.getByRole('button', { name: 'Mic' })).not.toHaveAttribute('data-tone');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Menu" icon="menu" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders children in place of an icon', () => {
    const { container } = render(
      <IconButton label="Account">
        <span data-testid="glyph">SY</span>
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Account' })).toContainElement(
      screen.getByTestId('glyph')
    );
    expect(container.querySelector('svg')).toBeNull();
  });
});
