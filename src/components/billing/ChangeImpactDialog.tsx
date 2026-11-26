/**
 * @fileoverview Shows, in plain words, what a challan or agreement change will touch (bills not
 * sent yet, bills already sent, items going below zero) and asks why before saving. Each bill
 * opens a short preview beside the dialog (on phones it replaces the dialog body, with Back).
 * A change dated in a closed financial year gets only the closed-year line and a Close button:
 * nobody may make it.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, DocNumber, Field, Input, Modal, Notice } from '../ui';
import { NegativeStockList } from '../BillIntegrity';
import { BillPreviewPanel } from './BillPreviewPanel';
import { closedYearMessage, fyEnd } from '../../utils/financialYear';
import type { GateAffectedBill, GateReport } from '../../types';
import styles from './ChangeImpactDialog.module.css';

interface Props {
  report: GateReport;
  busy: boolean;
  onCancel: () => void;
  /** Called with the trimmed reason (empty when none was typed). */
  onConfirm: (reason: string) => void;
}

/** The dialog title for a report that is not a closed year. */
function impactTitle(report: GateReport): string {
  const n = report.affected.length;
  if (n > 0) return `This change will update ${n} ${n === 1 ? 'bill' : 'bills'}`;
  if (report.negative.length > 0) return 'Stock will go below zero';
  return 'Check this change';
}

export function ChangeImpactDialog({ report, busy, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [openBillId, setOpenBillId] = useState<string | null>(null);
  const idPrefix = useId();
  const panelId = `${idPrefix}-bill-panel`;
  const rowId = (billId: string) => `${idPrefix}-bill-${billId}`;

  // When the panel closes, hand focus back to the bill row that opened it.
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    if (openBillId) {
      lastOpen.current = openBillId;
      return;
    }
    const last = lastOpen.current;
    lastOpen.current = null;
    if (last) document.getElementById(rowId(last))?.focus();
    // rowId only depends on the stable idPrefix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBillId]);

  const closePanel = useCallback(() => setOpenBillId(null), []);
  const toggleBill = (billId: string) => setOpenBillId(cur => (cur === billId ? null : billId));

  if (report.blocked === 'closedYear' && report.closedYear) {
    return (
      <Modal isOpen onClose={onCancel} title="This year is closed">
        <Notice tone="danger">
          {closedYearMessage(report.closedYear, fyEnd(report.closedYear))}
        </Notice>
        <div className={styles.actions}>
          <Button onClick={onCancel}>Close</Button>
        </div>
      </Modal>
    );
  }

  const drafts = report.affected.filter(b => !b.issued);
  const issued = report.affected.filter(b => b.issued);
  const blocked = report.blocked === 'role';
  const trimmed = reason.trim();
  const missingReason = report.requiresReason && trimmed === '';
  const openBill = report.affected.find(b => b.billId === openBillId) ?? null;

  const billList = (bills: GateAffectedBill[]) => (
    <ul className={styles.list}>
      {bills.map(b => {
        const open = b.billId === openBillId;
        return (
          <li key={b.billId}>
            <Button
              id={rowId(b.billId)}
              variant="ghost"
              className={styles.billButton}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              aria-pressed={open}
              onClick={() => toggleBill(b.billId)}
            >
              <DocNumber value={b.billNumber} /> <span className={styles.view}>View</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={impactTitle(report)}
      size={openBill ? 'wide' : 'default'}
    >
      <div className={`${styles.layout} ${openBill ? styles.withPanel : ''}`}>
        <div className={styles.main}>
          {blocked && (
            <Notice tone="warning">
              These months are already billed. Only an owner or manager can make this change.
            </Notice>
          )}
          {drafts.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.heading}>Not sent yet ({drafts.length})</h3>
              <p className={styles.helper}>We&apos;ll update these. Check them before sending.</p>
              {billList(drafts)}
            </section>
          )}
          {issued.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.heading}>Already sent to the client ({issued.length})</h3>
              <p className={styles.helper}>
                We won&apos;t change a sent bill. We&apos;ll prepare a correction with the
                difference for you to review and send.
              </p>
              {billList(issued)}
            </section>
          )}
          {report.negative.length > 0 && (
            <section className={styles.section}>
              {report.affected.length > 0 && (
                <h3 className={styles.heading}>Stock will go below zero</h3>
              )}
              <p className={styles.helper}>
                Some items will show less than zero in stock. Check the challan quantities before
                saving.
              </p>
              <NegativeStockList spans={report.negative} />
            </section>
          )}
          {!blocked && (
            <div className={styles.section}>
              <Field label="Why are you making this change?" required={report.requiresReason}>
                <Input
                  value={reason}
                  placeholder="e.g. wrong quantity on challan"
                  onChange={e => setReason(e.target.value)}
                />
              </Field>
            </div>
          )}
          <div className={styles.actions}>
            {blocked ? (
              <Button onClick={onCancel}>Close</Button>
            ) : (
              <>
                <Button onClick={onCancel} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={missingReason}
                  onClick={() => onConfirm(trimmed)}
                >
                  Save change
                </Button>
              </>
            )}
          </div>
        </div>
        {openBill && (
          <div className={styles.side}>
            <BillPreviewPanel
              id={panelId}
              billId={openBill.billId}
              billNumber={openBill.billNumber}
              onClose={closePanel}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
