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
  /** Tighter cell padding for wide statement tables. */
  dense?: boolean;
};

export function Table({
  children,
  className,
  caption,
  dense,
  'aria-label': ariaLabel,
}: TableProps) {
  return (
    <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
      <table
        className={[styles.table, dense ? styles.dense : ''].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
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
  /**
   * Editable grids on phones (≤768): the row becomes a CSS grid with one divider
   * under the whole row and compact cells without their own dividers. The page
   * places the cells (`grid-template-areas` on the row, `grid-area` on cells).
   */
  stackOnMobile?: boolean;
  /** `total`: a totals / balance row (top rule, heavier weight, raised background). */
  variant?: 'total';
};

export function Tr({
  onClick,
  stackOnMobile,
  variant,
  className: classNameProp,
  children,
  onKeyDown,
  ...rest
}: TrProps) {
  const className =
    [
      stackOnMobile ? styles.stack : '',
      variant === 'total' ? styles.total : '',
      classNameProp ?? '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;
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
