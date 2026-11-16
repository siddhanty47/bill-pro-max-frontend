import type { MouseEvent, ReactNode } from 'react';
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
  return (
    <span className={styles.actions} onClick={stop}>
      {primary}
      {items.length > 0 && (
        <Menu trigger={p => <IconButton label="More actions" icon="more" {...p} />}>
          {items.map(item => (
            <MenuItem
              key={item.label}
              disabled={item.disabled}
              className={item.tone === 'danger' ? styles.danger : undefined}
              onSelect={item.onClick}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </span>
  );
}
