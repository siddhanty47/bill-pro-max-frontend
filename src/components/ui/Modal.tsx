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

const FIELD_NOT = ':not([disabled]):not([tabindex="-1"])';
const FOCUSABLE = `input${FIELD_NOT}:not([type="hidden"]), select${FIELD_NOT}, textarea${FIELD_NOT}`;

/**
 * Reusable modal dialog with optional color-coded variant
 * for distinguishing delivery (blue) and return (amber) flows.
 */
export function Modal({ isOpen, onClose, title, children, variant, size = 'default' }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Autofocus once per open, a frame later (after children mount). Skip it when the
  // user already moved focus into the dialog (e.g. an early click on a field), so
  // the frame never steals focus back.
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const active = document.activeElement;
      if (dialog && active && active !== dialog && dialog.contains(active)) return;
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      // A nested widget (e.g. an open Menu) that already handled Escape calls
      // preventDefault — then only that widget closes, not the modal.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
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
        ref={dialogRef}
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
