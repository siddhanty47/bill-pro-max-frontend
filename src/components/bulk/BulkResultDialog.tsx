/**
 * @fileoverview The "Done" dialog after a bulk run: one line per outcome ("2 deleted") and
 * the skipped rows, each with its reason.
 */
import { Button, Modal } from '../ui';
import styles from './BulkDialogs.module.css';

export type BulkSkip = { label: string; reason: string };

export type BulkResultDialogProps = {
  /** Outcome lines, e.g. `['2 marked as sent']`. */
  lines: string[];
  /** Rows the run skipped or failed, in table order. */
  skipped: BulkSkip[];
  onClose: () => void;
  /** Plural noun for the skipped list's accessible name, "Skipped {noun}" (default "rows"). */
  noun?: string;
  /** Show labels in the number font: true for document numbers (default), false for names. */
  monoLabels?: boolean;
};

export function BulkResultDialog({
  lines,
  skipped,
  onClose,
  noun = 'rows',
  monoLabels = true,
}: BulkResultDialogProps) {
  return (
    <Modal isOpen onClose={onClose} title="Done">
      {lines.map((line, i) => (
        <p key={i} className={styles.text}>
          {line}
        </p>
      ))}
      {skipped.length > 0 && (
        <div className={styles.section}>
          <p className={styles.text}>Skipped ({skipped.length})</p>
          <ul className={styles.list} aria-label={`Skipped ${noun}`}>
            {skipped.map(({ label, reason }, i) => (
              <li key={`${i}-${label}`}>
                {monoLabels ? <span className="mono">{label}</span> : label}: {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
