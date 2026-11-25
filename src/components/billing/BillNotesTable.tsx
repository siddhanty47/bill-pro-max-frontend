/**
 * The credit/debit notes table shared by the Notes page, the bill page's Notes tab and the
 * party page's Notes tab: number ("Draft" until issued), type, bill, date, signed amount, status
 * and source, with a phone list. Rows open the note.
 */
import type { ReactNode } from 'react';
import { DataTable, DocNumber, NotAdded, StatusChip, type Column } from '../ui';
import { noteSign } from '../../utils/billMoney';
import { formatDate, formatMoney } from '../../utils/format';
import { NOTE_SOURCE_LABEL, NOTE_TYPE_LABEL } from '../../utils/billNoteLabels';
import type { BillNote } from '../../types';

export interface BillNotesTableProps {
  notes: BillNote[];
  'aria-label': string;
  empty: ReactNode;
  /** Show the Bill column (off on a bill's own page) */
  showBill?: boolean;
  /** Party name of a note; when given, a Party column (and phone subtitle) is shown */
  partyName?: (note: BillNote) => string;
}

const notePath = (n: BillNote) => `/bill-notes/${n._id}`;
const signedTotal = (n: BillNote) => formatMoney(noteSign(n.type) * n.totalAmount);
const numberCell = (n: BillNote) =>
  n.noteNumber ? <DocNumber value={n.noteNumber} to={notePath(n)} /> : 'Draft';
const billCell = (n: BillNote) => <DocNumber value={n.billNumber} to={`/bills/${n.billId}`} />;

export function BillNotesTable({
  notes,
  'aria-label': ariaLabel,
  empty,
  showBill = true,
  partyName,
}: BillNotesTableProps) {
  const columns: Column<BillNote>[] = [
    { key: 'noteNumber', header: 'Number', nowrap: true, render: numberCell },
    { key: 'type', header: 'Type', nowrap: true, render: n => NOTE_TYPE_LABEL[n.type] },
    ...(showBill ? [{ key: 'billNumber', header: 'Bill', nowrap: true, render: billCell }] : []),
    ...(partyName
      ? [{ key: 'partyId', header: 'Party', render: (n: BillNote) => partyName(n) || <NotAdded /> }]
      : []),
    {
      key: 'noteDate',
      header: 'Date',
      nowrap: true,
      render: n => (n.noteDate ? formatDate(n.noteDate) : <NotAdded />),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: signedTotal,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: n => <StatusChip status={n.status} />,
    },
    {
      key: 'source',
      header: 'Source',
      nowrap: true,
      hideOnMobile: true,
      render: n => NOTE_SOURCE_LABEL[n.source],
    },
  ];

  return (
    <DataTable
      aria-label={ariaLabel}
      columns={columns}
      rows={notes}
      rowKey={n => n._id}
      rowLink={notePath}
      empty={empty}
      mobile={{
        title: numberCell,
        badge: n => <StatusChip status={n.status} />,
        subtitle: partyName,
        meta: n => [
          NOTE_TYPE_LABEL[n.type],
          showBill && (
            <span key="bill" className="mono">
              {n.billNumber}
            </span>
          ),
          n.noteDate ? formatDate(n.noteDate) : '',
          <span key="amount" className="mono">
            {signedTotal(n)}
          </span>,
          NOTE_SOURCE_LABEL[n.source],
        ],
      }}
    />
  );
}
