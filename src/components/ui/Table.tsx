import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Table.module.css';

export type CellProps = {
  align?: 'left' | 'right';
  mono?: boolean;
  hideOnMobile?: boolean;
  children?: ReactNode;
};

function cellClass({ align = 'left', mono, hideOnMobile }: Omit<CellProps, 'children'>) {
  return [
    align === 'right' ? styles.right : '',
    mono ? styles.mono : '',
    hideOnMobile ? styles.hideOnMobile : '',
  ]
    .filter(Boolean)
    .join(' ');
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

export function Tr({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) return <tr>{children}</tr>;
  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) onClick();
  };
  return (
    <tr className={styles.clickable} tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown}>
      {children}
    </tr>
  );
}

export function Th({ children, ...rest }: CellProps) {
  return <th className={cellClass(rest) || undefined}>{children}</th>;
}

export function Td({ children, ...rest }: CellProps) {
  return <td className={cellClass(rest) || undefined}>{children}</td>;
}
