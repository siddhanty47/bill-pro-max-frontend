import { Icon } from './Icon';
import styles from './Brand.module.css';

export type BrandProps = {
  /** `md` (default) matches the app header; `sm` suits tight bars. */
  size?: 'sm' | 'md';
  /** At ≤768 show the mark only; the wordmark stays in the accessible name. */
  collapseName?: boolean;
  /** Placement only. */
  className?: string;
};

/** The Bill Pro Max mark with its wordmark. Decorative-free: the wordmark is real text. */
export function Brand({ size = 'md', collapseName, className }: BrandProps) {
  return (
    <span className={[styles.brand, styles[size], className ?? ''].filter(Boolean).join(' ')}>
      <Icon name="brand" size={size === 'sm' ? 16 : 20} className={styles.mark} />
      <span className={collapseName ? styles.collapsible : undefined}>Bill Pro Max</span>
    </span>
  );
}
