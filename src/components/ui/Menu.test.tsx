import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Menu, MenuDivider, MenuItem, MenuLabel } from './Menu';
import { placePanel } from './placePanel';

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

  it('focuses the last item on ArrowUp when no item has focus', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByText('Signed in') });
    expect(screen.getByRole('menu')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
  });

  it('keeps focus in the menu after mousedown on a label so Escape still closes it', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByText('Signed in') });
    expect(screen.getByRole('menu')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('focuses the menu itself when it has no enabled items', async () => {
    const user = userEvent.setup();
    render(
      <Menu
        trigger={props => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      >
        <MenuLabel>Nothing here</MenuLabel>
      </Menu>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menu')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toHaveFocus();
  });

  it('puts className on the root wrapper and menuClassName plus native props on the panel', async () => {
    const user = userEvent.setup();
    render(
      <Menu
        className="slot"
        menuClassName="panel"
        aria-label="Account"
        data-testid="panel"
        trigger={props => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      >
        <MenuItem>Profile</MenuItem>
      </Menu>
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.parentElement).toHaveClass('root', 'slot');
    expect(trigger.parentElement?.tagName).toBe('DIV');
    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(menu).toHaveClass('menu', 'panel');
    expect(menu).not.toHaveClass('slot');
    expect(menu).toHaveAttribute('data-testid', 'panel');
  });

  it('prevents default on Escape so an enclosing Modal stays open', async () => {
    const onModalKey = vi.fn();
    const { user, trigger } = setup();
    document.addEventListener('keydown', onModalKey);
    await user.click(trigger);
    await user.keyboard('{Escape}');
    document.removeEventListener('keydown', onModalKey);
    expect(onModalKey).toHaveBeenCalledWith(expect.objectContaining({ defaultPrevented: true }));
  });

  it('renders label and divider with proper roles', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});

describe('Menu portal and placement', () => {
  it('renders the panel in document.body, outside the root wrapper', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(trigger.parentElement).not.toContainElement(menu);
  });

  it('keeps the menu open for a mousedown inside the portalled panel', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('menu') });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on scroll outside the panel but not inside it', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    fireEvent.scroll(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('returns focus to the trigger on scroll only when focus was inside the panel', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    screen.getByText('Outside').setAttribute('tabindex', '-1');
    screen.getByText('Outside').focus();
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).not.toHaveFocus();
  });

  it('keeps aria-disabled items focusable but inert', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu trigger={p => <button {...p}>Open</button>}>
        <MenuItem aria-disabled="true" onSelect={onSelect}>
          Locked
        </MenuItem>
        <MenuItem onSelect={onSelect}>Open item</MenuItem>
      </Menu>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const locked = screen.getByRole('menuitem', { name: 'Locked' });
    // Initial focus skips the disabled item, arrows can still reach it.
    expect(screen.getByRole('menuitem', { name: 'Open item' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(locked).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('repositions on resize', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const menu = screen.getByRole('menu');
    menu.style.setProperty('top', '999px');
    fireEvent(window, new Event('resize'));
    expect(menu.style.top).not.toBe('999px');
  });
});

describe('placePanel', () => {
  const make = (rect: Partial<DOMRect>, size: { w: number; h: number }) => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, ...rect }) as DOMRect;
    const panel = document.createElement('div');
    Object.defineProperty(panel, 'offsetWidth', { value: size.w });
    Object.defineProperty(panel, 'offsetHeight', { value: size.h });
    return { trigger, panel };
  };

  it('opens below, end-aligned with the trigger', () => {
    const { trigger, panel } = make(
      { top: 100, bottom: 130, left: 700, right: 740 },
      { w: 200, h: 100 }
    );
    placePanel(panel, trigger, 'end', 1280, 800);
    expect(panel.style.top).toBe('136px');
    expect(panel.style.left).toBe('540px');
  });

  it('aligns to the start edge', () => {
    const { trigger, panel } = make(
      { top: 100, bottom: 130, left: 300, right: 340 },
      { w: 200, h: 100 }
    );
    placePanel(panel, trigger, 'start', 1280, 800);
    expect(panel.style.left).toBe('300px');
  });

  it('flips above when it does not fit below and there is more room above', () => {
    const { trigger, panel } = make(
      { top: 700, bottom: 730, left: 700, right: 740 },
      { w: 200, h: 120 }
    );
    placePanel(panel, trigger, 'end', 1280, 800);
    expect(panel.style.top).toBe('574px');
  });

  it('stays below when there is no more room above', () => {
    const { trigger, panel } = make(
      { top: 20, bottom: 50, left: 700, right: 740 },
      { w: 200, h: 780 }
    );
    placePanel(panel, trigger, 'end', 1280, 800);
    expect(panel.style.top).toBe('56px');
  });

  it('clamps horizontally inside the viewport', () => {
    const { trigger, panel } = make({ top: 10, bottom: 40, left: 0, right: 30 }, { w: 200, h: 50 });
    placePanel(panel, trigger, 'end', 1280, 800);
    expect(panel.style.left).toBe('8px');
    const b = make({ top: 10, bottom: 40, left: 1200, right: 1230 }, { w: 200, h: 50 });
    placePanel(b.panel, b.trigger, 'start', 1280, 800);
    expect(b.panel.style.left).toBe('1072px');
  });

  it('leaves left to the CSS on narrow phones', () => {
    const { trigger, panel } = make(
      { top: 10, bottom: 40, left: 300, right: 340 },
      { w: 200, h: 50 }
    );
    panel.style.setProperty('left', '5px');
    placePanel(panel, trigger, 'end', 400, 800);
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('46px');
  });
});
