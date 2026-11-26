/**
 * @fileoverview The Bills page's confirm and message dialogs (kit `Modal`), used instead of
 * `window.confirm` / `alert`.
 */
import { useState, type ReactNode } from 'react';
import { Button, Modal } from '../../components/ui';
import styles from './BillDialogs.module.css';

export type ConfirmRequest = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  /** The label of the button that closes without acting (default "Cancel"). */
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
};

/** A confirm dialog: Cancel closes, the confirm button runs `onConfirm` and then closes. */
export function BillConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const confirm = async () => {
    setBusy(true);
    try {
      await request.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title={request.title}>
      {request.body && <p className={styles.text}>{request.body}</p>}
      <div className={styles.actions}>
        <Button onClick={onClose} disabled={busy}>
          {request.cancelLabel ?? 'Cancel'}
        </Button>
        <Button variant={request.danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>
          {request.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** A message with a single Close button (e.g. a failed action). */
export function BillMessageDialog({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string | null;
  onClose: () => void;
}) {
  if (message == null) return null;
  return (
    <Modal isOpen onClose={onClose} title={title}>
      <p className={styles.text}>{message}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
