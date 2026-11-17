import { useId, type MouseEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Menu, MenuItem } from './Menu';
import styles from './RowActions.module.css';

export type RowActionItem = {
  label: string;
  onClick: () => void;
  tone?: 'danger';
  disabled?: boolean;
  icon?: IconName;
  /** A muted second line under the label (e.g. why the item is disabled); announced as the item's description. */
  hint?: string;
};

export type RowActionsProps = {
  /** The one contextual action, shown as a small button (e.g. a `Button size="sm"`). */
  primary?: ReactNode;
  /** Everything else, in a "More actions" menu. */
  items: RowActionItem[];
};

const stop = (e: MouseEvent) => e.stopPropagation();

/** Row actions for list tables and phone lists: one primary action + a "More actions" menu. */
export function RowActions({ primary, items }: RowActionsProps) {
  const baseId = useId();
  return (
    <span className={styles.actions} onClick={stop}>
      {primary}
      {items.length > 0 && (
        <Menu trigger={p => <IconButton label="More actions" icon="more" {...p} />}>
          {items.map((item, i) => (
            <MenuItem
              key={item.label}
              aria-disabled={item.disabled || undefined}
              tone={item.tone}
              onSelect={item.onClick}
              aria-describedby={item.hint ? `${baseId}-${i}` : undefined}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.hint ? (
                <span className={styles.text}>
                  {item.label}
                  <span id={`${baseId}-${i}`} className={styles.hint} aria-hidden="true">
                    {item.hint}
                  </span>
                </span>
              ) : (
                item.label
              )}
            </MenuItem>
          ))}
        </Menu>
      )}
    </span>
  );
}
