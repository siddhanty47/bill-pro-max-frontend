/**
 * Credit/debit notes list. Type, status and source filter on the server; the notes endpoint has
 * no text search, so search (note number, bill number, party) runs over the loaded notes.
 */
import { useMemo, useRef, useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { useGetAllBillNotesQuery } from '../api/billNoteApi';
import { useGetPartiesQuery } from '../api/partyApi';
import {
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  FilterBar,
  NotAdded,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { noteSign } from '../utils/billMoney';
import { formatDate, formatMoney } from '../utils/format';
import { NOTE_SOURCE_LABEL, NOTE_TYPE_LABEL } from '../utils/billNoteLabels';
import type { BillNote, BillNoteSource, BillNoteStatus, BillNoteType } from '../types';

const notePath = (n: BillNote) => `/bill-notes/${n._id}`;
const signedTotal = (n: BillNote) => formatMoney(noteSign(n.type) * n.totalAmount);

export function BillNotesPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const [searchTerm, setSearchTerm] = useState('');
  const [type, setType] = useState<BillNoteType | ''>('');
  const [status, setStatus] = useState<BillNoteStatus | ''>('');
  const [source, setSource] = useState<BillNoteSource | ''>('');
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkey('/', () => searchRef.current?.focus());

  const {
    data: notes,
    isLoading,
    error,
    refetch,
  } = useGetAllBillNotesQuery(
    {
      businessId: currentBusinessId || '',
      type: type || undefined,
      status: status || undefined,
      source: source || undefined,
    },
    { skip: !currentBusinessId }
  );
  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const partyNames = useMemo(() => new Map((parties ?? []).map(p => [p._id, p.name])), [parties]);
  const partyName = (n: BillNote) => partyNames.get(n.partyId) ?? '';

  const search = searchTerm.trim().toLowerCase();
  const rows = (notes ?? []).filter(
    n =>
      !search ||
      (n.noteNumber ?? '').toLowerCase().includes(search) ||
      n.billNumber.toLowerCase().includes(search) ||
      partyName(n).toLowerCase().includes(search)
  );
  const hasFilters = Boolean(search || type || status || source);

  const numberCell = (n: BillNote) =>
    n.noteNumber ? <DocNumber value={n.noteNumber} to={notePath(n)} /> : 'Draft';
  const billCell = (n: BillNote) => <DocNumber value={n.billNumber} to={`/bills/${n.billId}`} />;

  const columns: Column<BillNote>[] = [
    { key: 'noteNumber', header: 'Number', nowrap: true, render: numberCell },
    { key: 'type', header: 'Type', nowrap: true, render: n => NOTE_TYPE_LABEL[n.type] },
    { key: 'billNumber', header: 'Bill', nowrap: true, render: billCell },
    { key: 'partyId', header: 'Party', render: n => partyName(n) || <NotAdded /> },
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

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }
  if (isLoading) return <Spinner message="Loading notes…" />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Notes" />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search notes"
          hint="/"
          placeholder="Search note no., bill no. or party"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select
          aria-label="Type"
          value={type}
          onChange={e => setType(e.target.value as BillNoteType | '')}
        >
          <option value="">All types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </Select>
        <Select
          aria-label="Status"
          value={status}
          onChange={e => setStatus(e.target.value as BillNoteStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select
          aria-label="Source"
          value={source}
          onChange={e => setSource(e.target.value as BillNoteSource | '')}
        >
          <option value="">All sources</option>
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </Select>
      </FilterBar>

      <Card padded={false}>
        <DataTable
          aria-label="Notes"
          columns={columns}
          rows={rows}
          rowKey={n => n._id}
          rowLink={notePath}
          empty={
            <EmptyState title={hasFilters ? 'No notes match these filters' : 'No notes yet'} />
          }
          mobile={{
            title: numberCell,
            badge: n => <StatusChip status={n.status} />,
            subtitle: n => partyName(n),
            meta: n => [
              NOTE_TYPE_LABEL[n.type],
              <span key="bill" className="mono">
                {n.billNumber}
              </span>,
              n.noteDate ? formatDate(n.noteDate) : '',
              <span key="amount" className="mono">
                {signedTotal(n)}
              </span>,
              NOTE_SOURCE_LABEL[n.source],
            ],
          }}
        />
      </Card>
    </div>
  );
}
