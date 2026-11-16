import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
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

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)';

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

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR);
    (first ?? menuRef.current)?.focus();
    const onMouseDown = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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
      {open && (
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
        </MenuContext.Provider>
      )}
    </div>
  );
}

export type MenuItemProps = {
  onSelect?: () => void;
  to?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function MenuItem({
  onSelect,
  to,
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: MenuItemProps) {
  const { close } = useContext(MenuContext);
  const classes = [styles.item, className].filter(Boolean).join(' ');
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
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
        className={classes}
        onClick={handleClick as unknown as (e: MouseEvent<HTMLAnchorElement>) => void}
      >
        {children}
      </Link>
    );
  }
  return (
    <button {...rest} type={type} role="menuitem" className={classes} onClick={handleClick}>
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
