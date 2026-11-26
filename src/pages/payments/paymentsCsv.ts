/** @fileoverview Payment labels shared by the payments table and its CSV export. */
import { csvDate, toCsv } from '../../utils/csv';
import type { Payment } from '../../types';

export const METHOD_LABELS: Record<Payment['method'], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  other: 'Other',
};

export const typeLabel = (p: Payment) => (p.type === 'receivable' ? 'Received' : 'Paid');
const statusLabel = (p: Payment) => p.status.charAt(0).toUpperCase() + p.status.slice(1);

/** The CSV of `payments`: the columns the table shows, amount as a plain number. */
export function paymentsCsv(payments: Payment[], partyName: (partyId: string) => string): string {
  return toCsv(
    ['Date', 'Type', 'Party', 'Amount', 'Method', 'Reference', 'Status'],
    payments.map(p => [
      csvDate(p.date),
      typeLabel(p),
      partyName(p.partyId),
      p.amount,
      METHOD_LABELS[p.method] ?? p.method,
      p.reference ?? '',
      statusLabel(p),
    ])
  );
}
