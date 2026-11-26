/**
 * @fileoverview A short look at one bill from inside the change dialog: number, status, period,
 * money and the first few item lines, with a link that opens the full bill in a new tab.
 * Escape closes this panel only (it is preventDefault-ed, so the Modal around it stays open).
 */
import { useEffect, useRef } from 'react';
import {
  Button,
  Card,
  DocNumber,
  IconButton,
  Notice,
  Spinner,
  StatusChip,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  TextLink,
} from '../ui';
import { DetailField } from '../DetailPageShell';
import { useGetBillQuery } from '../../api/billApi';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import { balanceDue, effectiveAmount } from '../../utils/billMoney';
import { formatDate, formatMoney } from '../../utils/format';
import styles from './BillPreviewPanel.module.css';

/** Item lines shown before "+ N more items". */
export const PREVIEW_ITEM_LIMIT = 6;

interface Props {
  billId: string;
  /** Shown while the bill loads (or fails to) */
  billNumber?: string;
  /** Element id, for the bill rows' `aria-controls` */
  id?: string;
  onClose: () => void;
  /** Mobile only: back to the change (defaults to `onClose`) */
  onBack?: () => void;
}

export function BillPreviewPanel({ billId, billNumber, id, onClose, onBack }: Props) {
  const { currentBusinessId } = useCurrentBusiness();
  const { currentData: bill, isError } = useGetBillQuery(
    { businessId: currentBusinessId!, billId },
    { skip: !currentBusinessId }
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the panel when it opens: on phones it replaces the list the user clicked in.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Capture phase, so this runs before the Modal's own (bubble) Escape handler sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const extra = bill ? bill.items.length - PREVIEW_ITEM_LIMIT : 0;

  return (
    <div
      ref={rootRef}
      id={id}
      className={styles.panel}
      tabIndex={-1}
      role="region"
      aria-label="Bill preview"
    >
      <div className={styles.back}>
        <Button variant="ghost" icon="arrow-left" onClick={onBack ?? onClose}>
          Back to the change
        </Button>
      </div>
      <Card>
        <div className={styles.header}>
          {(bill?.billNumber ?? billNumber) && (
            <DocNumber value={bill?.billNumber ?? billNumber ?? ''} wrap />
          )}
          {bill && <StatusChip status={bill.status} />}
          <span className={styles.close}>
            <IconButton label="Close bill" icon="close" onClick={onClose} />
          </span>
        </div>
        {!bill ? (
          <div className={styles.body}>
            {isError ? <Notice tone="danger">Couldn&apos;t load this bill.</Notice> : <Spinner />}
          </div>
        ) : (
          <div className={styles.body}>
            <div>
              <DetailField
                label="Period"
                value={`${formatDate(bill.billingPeriod.start)} – ${formatDate(bill.billingPeriod.end)}`}
              />
              <DetailField
                label="Bill date"
                value={formatDate(bill.billDate ?? bill.billingPeriod.end)}
              />
              <DetailField label="Bill total" mono value={formatMoney(effectiveAmount(bill))} />
              <DetailField label="Paid" mono value={formatMoney(bill.amountPaid ?? 0)} />
              <DetailField label="Balance" mono value={formatMoney(balanceDue(bill))} />
            </div>
            {bill.items.length > 0 && (
              <Table aria-label="Bill items">
                <THead>
                  <Tr>
                    <Th>Item</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Amount</Th>
                  </Tr>
                </THead>
                <TBody>
                  {bill.items.slice(0, PREVIEW_ITEM_LIMIT).map((item, i) => (
                    <Tr key={`${item.itemId}-${i}`}>
                      <Td>{item.itemName}</Td>
                      <Td align="right" mono>
                        {item.quantity}
                      </Td>
                      <Td align="right" mono nowrap>
                        {formatMoney(item.amount)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
            {extra > 0 && <p className={styles.more}>+ {extra} more items</p>}
            <div className={styles.footer}>
              <TextLink to={`/bills/${bill._id}`} target="_blank" rel="noopener">
                Open full bill
              </TextLink>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
