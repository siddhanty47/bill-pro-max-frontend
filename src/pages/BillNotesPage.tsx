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
  EmptyState,
  ErrorMessage,
  FilterBar,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
} from '../components/ui';
import { BillNotesTable } from '../components/billing/BillNotesTable';
import type { BillNote, BillNoteSource, BillNoteStatus, BillNoteType } from '../types';

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
        <BillNotesTable
          aria-label="Notes"
          notes={rows}
          partyName={partyName}
          empty={
            <EmptyState title={hasFilters ? 'No notes match these filters' : 'No notes yet'} />
          }
        />
      </Card>
    </div>
  );
}
