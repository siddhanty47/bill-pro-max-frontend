/**
 * @fileoverview Confirm and message dialogs (kit `Modal`) for list pages and their bulk
 * actions, used instead of `window.confirm` / `alert`. Open a confirm with `useConfirm`.
 */
import { useState, type ReactNode } from 'react';
import { Button, Modal } from '../ui';
import styles from './BulkDialogs.module.css';

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
export function BulkConfirmDialog({
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

/** A message with a single Close button (e.g. a failed action). Hidden while `message` is null. */
export function MessageDialog({
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
