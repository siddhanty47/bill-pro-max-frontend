import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Menu, MenuDivider, MenuItem, MenuLabel } from './Menu';

function setup(onSelect = vi.fn(), align?: 'start' | 'end') {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <p>Outside</p>
      <Menu
        align={align}
        trigger={props => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      >
        <MenuLabel>Signed in</MenuLabel>
        <MenuItem onSelect={onSelect}>Profile</MenuItem>
        <MenuDivider />
        <MenuItem to="/settings">Settings</MenuItem>
        <MenuItem onSelect={onSelect} data-testid="last">
          Sign out
        </MenuItem>
      </Menu>
    </MemoryRouter>
  );
  return { user, onSelect, trigger: screen.getByRole('button', { name: 'Open' }) };
}

describe('Menu', () => {
  it('is closed initially with collapsed trigger state', () => {
    const { trigger } = setup();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('opens on click, wires aria-controls and focuses the first item', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  });

  it('moves focus with arrow keys, wrapping, Home and End', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Tab and returns focus to the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on outside mousedown but not on inside mousedown', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByText('Signed in') });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onSelect, closes and restores focus to the trigger', async () => {
    const { user, onSelect, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selects the focused item with Enter', async () => {
    const { user, onSelect, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders a "to" item as a link and closes after navigating', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const link = screen.getByRole('menuitem', { name: 'Settings' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/settings');
    await user.click(link);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('forwards native props on items', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByTestId('last')).toHaveAttribute('role', 'menuitem');
  });

  it('aligns to the end by default and to the start when asked', async () => {
    const first = setup();
    await first.user.click(first.trigger);
    expect(screen.getByRole('menu')).toHaveClass('alignEnd');
  });

  it('applies start alignment', async () => {
    const { user, trigger } = setup(vi.fn(), 'start');
    await user.click(trigger);
    expect(screen.getByRole('menu')).toHaveClass('alignStart');
  });

  it('renders label and divider with proper roles', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});
