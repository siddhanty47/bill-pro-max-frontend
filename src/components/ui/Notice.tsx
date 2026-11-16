import type { ReactNode } from 'react';
import styles from './Notice.module.css';

export type NoticeTone = 'success' | 'info' | 'warning' | 'danger';

export type NoticeProps = {
  tone: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Inline message box (form errors, "email sent" confirmations). Danger is announced as an alert. */
export function Notice({ tone, title, children, className }: NoticeProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={[styles.notice, styles[tone], className ?? ''].filter(Boolean).join(' ')}
    >
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
