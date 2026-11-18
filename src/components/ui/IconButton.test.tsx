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

  it('renders a small size with a smaller icon', () => {
    render(<IconButton label="Remove" icon="close" size="sm" />);
    const button = screen.getByRole('button', { name: 'Remove' });
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(button.querySelector('svg')).toHaveAttribute('width', '14');
  });

  it('keeps sm at 24px with a 44px hit area on phones, and danger filled on every size', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/IconButton.module.css', 'utf8');
    const phone = css.slice(css.lastIndexOf('@media (max-width: 768px)'));
    // The phone 44px rule must not beat sm: sm is re-asserted after it with higher specificity.
    expect(phone).toMatch(/\.iconBtn\.sm\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px/);
    expect(css).toMatch(/\.iconBtn\.sm::before\s*\{[^}]*width:\s*44px/);
    // danger is declared after sm and is as specific, so it keeps its fill.
    expect(css.indexOf('.iconBtn.danger')).toBeGreaterThan(css.indexOf('.iconBtn.sm {'));
    expect(css).not.toMatch(/^\.sm\b/m);
  });

  it('uses the regular size by default', () => {
    render(<IconButton label="Remove" icon="close" />);
    const button = screen.getByRole('button', { name: 'Remove' });
    expect(button).not.toHaveAttribute('data-size');
    expect(button.querySelector('svg')).toHaveAttribute('width', '18');
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
