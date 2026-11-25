/**
 * @fileoverview Shows what a challan or agreement change would touch (bills that
 * go out of date, bills already sent, items below zero) and asks for a reason
 * before saving.
 */
import { useState } from 'react';
import { Button, Field, Input, Modal, Notice, TextLink } from '../ui';
import { NegativeStockList } from '../BillIntegrity';
import { formatMoney } from '../../utils/format';
import type { GateAffectedBill, GateReport } from '../../types';
import styles from './ChangeImpactDialog.module.css';

interface Props {
  report: GateReport;
  busy: boolean;
  onCancel: () => void;
  /** Called with the trimmed reason (empty when none was typed). */
  onConfirm: (reason: string) => void;
}

/** "Draft debit note ₹X" / "Draft credit note ₹X" for an issued bill's expected correction. */
function DraftNoteLabel({ amount }: { amount: GateAffectedBill['noteAmount'] }) {
  if (amount === undefined || Math.abs(amount) < 0.01) return null;
  return (
    <>
      {' · '}
      <span>Draft {amount > 0 ? 'debit' : 'credit'} note</span>{' '}
      <span className="mono">{formatMoney(Math.abs(amount))}</span>
    </>
  );
}

export function ChangeImpactDialog({ report, busy, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const drafts = report.affected.filter(b => !b.issued);
  const issued = report.affected.filter(b => b.issued);
  const blocked = report.blocked === 'role';
  const trimmed = reason.trim();
  const missingReason = report.requiresReason && trimmed === '';

  return (
    <Modal isOpen onClose={onCancel} title="This change affects billed months">
      {blocked && (
        <Notice tone="warning">
          This month is already billed. Ask an owner or manager to make this change.
        </Notice>
      )}
      {drafts.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading}>May be marked out of date</h3>
          <ul className={styles.list}>
            {drafts.map(b => (
              <li key={b.billId}>
                <TextLink to={`/bills/${b.billId}`}>{b.billNumber}</TextLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      {issued.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading}>
            Already sent — will be rechecked; a correction may be needed
          </h3>
          <ul className={styles.list}>
            {issued.map(b => (
              <li key={b.billId}>
                <TextLink to={`/bills/${b.billId}`}>{b.billNumber}</TextLink>
                <DraftNoteLabel amount={b.noteAmount} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.negative.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading}>Stock will go below zero</h3>
          <NegativeStockList spans={report.negative} />
        </div>
      )}
      {report.affected.length > 0 && (
        <p className={styles.note}>Exact amounts appear on the bills after you save.</p>
      )}
      {!blocked && (
        <div className={styles.section}>
          <Field label="Reason" required={report.requiresReason}>
            <Input value={reason} onChange={e => setReason(e.target.value)} />
          </Field>
        </div>
      )}
      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={blocked || missingReason}
          onClick={() => onConfirm(trimmed)}
        >
          Save anyway
        </Button>
      </div>
    </Modal>
  );
}
