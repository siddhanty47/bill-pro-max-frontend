import type {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
  HTMLAttributes,
} from 'react';
import styles from './Table.module.css';

type CellExtras = {
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  hideOnMobile?: boolean;
};

export type ThProps = CellExtras & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'>;
export type TdProps = CellExtras & Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'>;

function cellClass(
  { align = 'left', mono, hideOnMobile }: CellExtras,
  className: string | undefined
) {
  return (
    [
      align === 'right' ? styles.right : '',
      align === 'center' ? styles.center : '',
      mono ? styles.mono : '',
      hideOnMobile ? styles.hideOnMobile : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

const INTERACTIVE = 'button, a, input, select, textarea, label';

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
    const hit = (e.target as Element).closest(INTERACTIVE);
    if (hit && e.currentTarget.contains(hit)) return;
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

export function Th({ align, mono, hideOnMobile, className, children, ...rest }: ThProps) {
  return (
    <th {...rest} className={cellClass({ align, mono, hideOnMobile }, className)}>
      {children}
    </th>
  );
}

export function Td({ align, mono, hideOnMobile, className, children, ...rest }: TdProps) {
  return (
    <td {...rest} className={cellClass({ align, mono, hideOnMobile }, className)}>
      {children}
    </td>
  );
}
