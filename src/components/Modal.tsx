/**
 * Modal dialog component.
 *
 * Automatically focuses the first interactive field when opened
 * so the user can start typing immediately.
 */
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

export type ModalVariant = 'delivery' | 'return';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: ModalVariant;
}

const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Reusable modal dialog with optional color-coded variant
 * for distinguishing delivery (blue) and return (amber) flows.
 */
export function Modal({ isOpen, onClose, title, children, variant }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      <div className={`${styles.modal} ${variant ? styles[variant] : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            &times;
          </button>
        </div>
        <div ref={bodyRef} className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
