/**
 * Modal dialog component.
 *
 * Automatically focuses the first interactive field when opened
 * so the user can start typing immediately.
 */
import { useEffect, useId, useRef } from 'react';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

export type ModalVariant = 'delivery' | 'return';

export type ModalSize = 'default' | 'form';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: ModalVariant;
  size?: ModalSize;
}

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Reusable modal dialog with optional color-coded variant
 * for distinguishing delivery (blue) and return (amber) flows.
 */
export function Modal({ isOpen, onClose, title, children, variant, size = 'default' }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      // A nested widget (e.g. an open Menu) that already handled Escape calls
      // preventDefault — then only that widget closes, not the modal.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        first?.focus();
      });
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${variant ? styles[variant] : ''} ${size === 'form' ? styles.formSize : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close" icon="close" onClick={onClose} className={styles.closeButton} />
        </div>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
