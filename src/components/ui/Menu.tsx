import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { placePanel } from './placePanel';
import styles from './Menu.module.css';

export type MenuTriggerProps = {
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
  'aria-controls': string | undefined;
  ref: RefObject<HTMLButtonElement | null>;
};

/**
 * `className` styles the root wrapper (trigger + panel) so callers can place it
 * in a layout; `menuClassName` and every other native prop go to the
 * `role="menu"` panel.
 */
export type MenuProps = {
  trigger: (props: MenuTriggerProps) => ReactNode;
  align?: 'start' | 'end';
  menuClassName?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

// aria-disabled items stay in the arrow-key order (focusable, so their hint can be read).
const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';
const ENABLED_ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)';

export function Menu({
  trigger,
  align = 'end',
  children,
  className,
  menuClassName,
  onKeyDown,
  ...rest
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (menuRef.current && triggerRef.current) {
        placePanel(menuRef.current, triggerRef.current, align);
      }
    };
    place();
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      // Only pull focus back to the trigger if it was inside the panel.
      if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const first =
      menuRef.current?.querySelector<HTMLElement>(ENABLED_ITEM_SELECTOR) ??
      menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR);
    (first ?? menuRef.current)?.focus();
    const onMouseDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      close();
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (e.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (e.key === 'ArrowUp')
      next = current === -1 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    items[next].focus();
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} ref={rootRef}>
      {trigger({
        onClick: () => setOpen(o => !o),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': open ? menuId : undefined,
        ref: triggerRef,
      })}
      {open &&
        createPortal(
          <MenuContext.Provider value={{ close }}>
            <div
              {...rest}
              id={menuId}
              role="menu"
              ref={menuRef}
              // Focusable so a mousedown on padding, a label or a divider keeps
              // focus inside the menu (Escape/arrows keep working).
              tabIndex={-1}
              className={[
                styles.menu,
                align === 'end' ? styles.alignEnd : styles.alignStart,
                menuClassName,
              ]
                .filter(Boolean)
                .join(' ')}
              onKeyDown={handleKeyDown}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body
        )}
    </div>
  );
}

export type MenuItemProps = {
  onSelect?: () => void;
  to?: string;
  /** Marks the item as unread/new: accent tint and a leading bar. */
  unread?: boolean;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function MenuItem({
  onSelect,
  to,
  unread,
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: MenuItemProps) {
  const { close } = useContext(MenuContext);
  const classes = [styles.item, unread && styles.unread, className].filter(Boolean).join(' ');
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // aria-disabled items are focusable but never activate: no consumer onClick,
    // no select, and a router link must not navigate.
    if (rest['aria-disabled'] === true || rest['aria-disabled'] === 'true') {
      e.preventDefault();
      return;
    }
    onClick?.(e);
    if (e.defaultPrevented) return;
    onSelect?.();
    close();
  };

  if (to) {
    return (
      <Link
        {...(rest as unknown as HTMLAttributes<HTMLAnchorElement>)}
        to={to}
        role="menuitem"
        data-unread={unread ? 'true' : undefined}
        className={classes}
        onClick={handleClick as unknown as (e: MouseEvent<HTMLAnchorElement>) => void}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      {...rest}
      type={type}
      role="menuitem"
      data-unread={unread ? 'true' : undefined}
      className={classes}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={[styles.label, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function MenuDivider({ className, ...rest }: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      {...rest}
      role="separator"
      className={[styles.divider, className].filter(Boolean).join(' ')}
    />
  );
}
