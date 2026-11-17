import type { ReactNode } from 'react';
import { Brand } from '../ui';
import { ScaffoldArt } from './ScaffoldArt';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <div className={styles.auth}>
      <div className={styles.formSide}>
        <Brand />
        <div className={styles.formWrap}>
          <div className={styles.form}>
            <h1 className={styles.title}>{title}</h1>
            {children}
            {footer && <div className={styles.footer}>{footer}</div>}
          </div>
        </div>
      </div>
      <div className={styles.art} aria-hidden="true">
        <ScaffoldArt />
      </div>
    </div>
  );
}
