import type {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
  HTMLAttributes,
} from 'react';
import { fromInnerControl } from './innerControl';
import styles from './Table.module.css';

type CellExtras = {
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  hideOnMobile?: boolean;
  /** Keep the cell's content on one line. */
  nowrap?: boolean;
};

export type ThProps = CellExtras & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'>;
export type TdProps = CellExtras & Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'>;

function cellClass(
  { align = 'left', mono, hideOnMobile, nowrap }: CellExtras,
  className: string | undefined
) {
  return (
    [
      align === 'right' ? styles.right : '',
      align === 'center' ? styles.center : '',
      mono ? styles.mono : '',
      hideOnMobile ? styles.hideOnMobile : '',
      nowrap ? styles.nowrap : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

export type TableProps = {
  children: ReactNode;
  /** On the scroll wrapper; placement only. */
  className?: string;
  /** Accessible name for the table (use when no visible heading names it). */
  'aria-label'?: string;
  /** Visually hidden `<caption>`; names the table for screen readers. */
  caption?: ReactNode;
};

export function Table({ children, className, caption, 'aria-label': ariaLabel }: TableProps) {
  return (
    <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
      <table className={styles.table} aria-label={ariaLabel}>
        {caption && <caption className={styles.caption}>{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export type TrProps = Omit<HTMLAttributes<HTMLTableRowElement>, 'onClick'> & {
  /** Fires on row click and on Enter when the row itself is focused. */
  onClick?: (e: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => void;
};

export function Tr({ onClick, className, children, onKeyDown, ...rest }: TrProps) {
  if (!onClick) {
    return (
      <tr className={className} onKeyDown={onKeyDown} {...rest}>
        {children}
      </tr>
    );
  }
  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (fromInnerControl(e)) return;
    onClick(e);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    onKeyDown?.(e);
    if (e.key === 'Enter' && e.target === e.currentTarget) onClick(e);
  };
  return (
    <tr
      tabIndex={0}
      {...rest}
      className={[styles.clickable, className ?? ''].filter(Boolean).join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </tr>
  );
}

export function Th({ align, mono, hideOnMobile, nowrap, className, children, ...rest }: ThProps) {
  return (
    <th {...rest} className={cellClass({ align, mono, hideOnMobile, nowrap }, className)}>
      {children}
    </th>
  );
}

export function Td({ align, mono, hideOnMobile, nowrap, className, children, ...rest }: TdProps) {
  return (
    <td {...rest} className={cellClass({ align, mono, hideOnMobile, nowrap }, className)}>
      {children}
    </td>
  );
}
