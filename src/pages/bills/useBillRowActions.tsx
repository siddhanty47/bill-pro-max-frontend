/**
 * @fileoverview The Bills table's row actions: Send / Mark paid as the primary button, and a
 * "More actions" menu with only the moves the bill's status allows (draft: Mark as sent, Cancel
 * bill, Delete; cancelled: Delete; every bill: Download invoice PDF). Issued bills never show
 * Delete, Cancel or Draft. Sending and marking as sent go through `useBillIssueGate`.
 */
import type { ReactNode } from 'react';
import {
  useDeleteBillMutation,
  useLazyDownloadBillPdfQuery,
  useSendBillEmailMutation,
  useUpdateBillStatusMutation,
} from '../../api/billApi';
import { getErrorMessage } from '../../api/baseApi';
import { Button, RowActions } from '../../components/ui';
import { useBillIssueGate } from '../../hooks/useBillIssueGate';
import { isIssued } from '../../utils/billStatus';
import type { Bill } from '../../types';
import type { ConfirmRequest } from './BillConfirmDialog';

interface Options {
  businessId: string;
  /** Opens a confirm dialog (from the page's `useConfirm`). */
  ask: (request: ConfirmRequest) => void;
  /** Shows a failed action's message. */
  onError: (message: string) => void;
}

export function useBillRowActions({ businessId, ask, onError }: Options) {
  const [updateBillStatus] = useUpdateBillStatusMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [sendBillEmail] = useSendBillEmailMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyDownloadBillPdfQuery();
  const gate = useBillIssueGate(businessId, { onError });

  const handleStatusChange = async (bill: Bill, newStatus: Bill['status']) => {
    try {
      await updateBillStatus({
        businessId,
        billId: bill._id,
        status: newStatus,
      }).unwrap();
    } catch (err) {
      onError(getErrorMessage(err));
    }
  };

  /** Issue a draft without emailing it; out of date and negative stock go through the gate. */
  const handleMarkSent = (bill: Bill) =>
    ask({
      title: `Mark ${bill.billNumber} as sent?`,
      body: 'The bill will be locked. Any later change is made with a correction, not by editing the bill.',
      confirmLabel: 'Mark as sent',
      onConfirm: () =>
        gate.attempt(
          bill,
          acknowledgeNegative =>
            updateBillStatus({
              businessId,
              billId: bill._id,
              status: 'sent',
              acknowledgeNegative,
            }).unwrap(),
          true,
          'markSent'
        ),
    });

  const handleCancelBill = (bill: Bill) =>
    ask({
      title: `Cancel ${bill.billNumber}?`,
      body: 'You can delete it afterwards.',
      cancelLabel: 'Keep bill',
      confirmLabel: 'Cancel bill',
      danger: true,
      onConfirm: () => handleStatusChange(bill, 'cancelled'),
    });

  const handleSendEmail = async (bill: Bill) => {
    await gate.attempt(bill, acknowledgeNegative =>
      sendBillEmail({
        businessId,
        billId: bill._id,
        acknowledgeNegative,
      }).unwrap()
    );
  };

  const handleDownloadPdf = async (bill: Bill) => {
    try {
      await downloadPdf({
        businessId,
        billId: bill._id,
        fileName: `invoice-${bill.billNumber}.pdf`,
      }).unwrap();
    } catch (err) {
      onError(getErrorMessage(err));
    }
  };

  const handleDelete = (bill: Bill) =>
    ask({
      title: `Delete ${bill.billNumber}?`,
      body: "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteBill({ businessId, billId: bill._id }).unwrap();
        } catch (err) {
          onError(getErrorMessage(err));
        }
      },
    });

  const rowActions = (bill: Bill) => {
    const removable = !isIssued(bill);
    const draft = bill.status === 'draft';
    let primary: ReactNode = null;
    if (bill.status === 'draft') {
      primary = (
        <Button size="sm" variant="primary" onClick={() => handleSendEmail(bill)}>
          Send
        </Button>
      );
    } else if (bill.status === 'sent' || bill.status === 'partial') {
      primary = (
        <Button size="sm" onClick={() => handleStatusChange(bill, 'paid')}>
          Mark paid
        </Button>
      );
    }
    return (
      <RowActions
        primary={primary}
        items={[
          ...(draft
            ? [
                {
                  label: 'Mark as sent',
                  hint: 'Locks the bill. No email is sent.',
                  onClick: () => handleMarkSent(bill),
                },
              ]
            : []),
          {
            label: 'Download invoice PDF',
            onClick: () => handleDownloadPdf(bill),
            disabled: isDownloading,
          },
          ...(draft ? [{ label: 'Cancel bill', onClick: () => handleCancelBill(bill) }] : []),
          ...(removable
            ? [{ label: 'Delete', onClick: () => handleDelete(bill), tone: 'danger' as const }]
            : []),
        ]}
      />
    );
  };

  return { rowActions, dialog: gate.dialog };
}
