import { Icon } from './Icon';
import styles from './Brand.module.css';

export type BrandProps = {
  /** `md` (default) matches the app header; `sm` suits tight bars. */
  size?: 'sm' | 'md';
  /** Placement only. */
  className?: string;
};

/** The Bill Pro Max mark with its wordmark. Decorative-free: the wordmark is real text. */
export function Brand({ size = 'md', className }: BrandProps) {
  return (
    <span className={[styles.brand, styles[size], className ?? ''].filter(Boolean).join(' ')}>
      <Icon name="brand" size={size === 'sm' ? 16 : 20} className={styles.mark} />
      <span>Bill Pro Max</span>
    </span>
  );
}
