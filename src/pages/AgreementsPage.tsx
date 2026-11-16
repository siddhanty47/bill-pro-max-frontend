/**
 * Agreements list page
 * Lists all agreements across all parties; editing happens on the detail page.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { useGetAgreementsQuery } from '../api/agreementApi';
import {
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  FilterBar,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  type Column,
} from '../components/ui';
import { formatDate } from '../utils/format';
import type { AgreementWithParty } from '../types';

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dateOf = (d: string | undefined) => (d ? formatDate(d) || '—' : '—');

export function AgreementsPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: agreements,
    isLoading,
    error,
    refetch,
  } = useGetAgreementsQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  useHotkey('/', () => searchRef.current?.focus());

  const filteredAgreements = (agreements || []).filter(agreement => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      agreement.partyName.toLowerCase().includes(term) ||
      agreement.agreementId.toLowerCase().includes(term) ||
      agreement.siteCode?.toLowerCase().includes(term);
    const matchesStatus = !statusFilter || agreement.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<AgreementWithParty>[] = [
    {
      key: 'agreementId',
      header: 'Agreement',
      nowrap: true,
      render: a => <DocNumber value={a.agreementId} to={`/agreements/${a.agreementId}`} />,
    },
    { key: 'partyName', header: 'Party', render: a => a.partyName },
    { key: 'siteCode', header: 'Site', nowrap: true, render: a => a.siteCode || '—' },
    { key: 'startDate', header: 'Start', nowrap: true, render: a => dateOf(a.startDate) },
    {
      key: 'endDate',
      header: 'End',
      nowrap: true,
      hideOnMobile: true,
      render: a => dateOf(a.endDate),
    },
    {
      key: 'billingCycle',
      header: 'Billing cycle',
      hideOnMobile: true,
      nowrap: true,
      render: a => sentenceCase(a.terms.billingCycle),
    },
    {
      key: 'paymentDueDays',
      header: 'Payment due',
      hideOnMobile: true,
      nowrap: true,
      render: a => `${a.terms.paymentDueDays} days`,
    },
    {
      key: 'rates',
      header: 'Items',
      mono: true,
      align: 'right',
      hideOnMobile: true,
      render: a => a.rates.length,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: a => <StatusChip status={a.status} />,
    },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <Spinner message="Loading agreements…" />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <PageHeader title="Agreements" />

      <FilterBar>
        <SearchInput
          ref={searchRef}
          label="Search agreements"
          hint="/"
          placeholder="Party, agreement or site"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </Select>
      </FilterBar>

      <Card padded={false}>
        <DataTable
          aria-label="Agreements"
          columns={columns}
          rows={filteredAgreements}
          rowKey={a => a.agreementId}
          onRowClick={a => navigate(`/agreements/${a.agreementId}`)}
          empty={
            (agreements || []).length === 0 ? (
              <EmptyState title="No agreements yet" />
            ) : (
              <EmptyState title="No agreements match these filters" />
            )
          }
          mobile={{
            title: a => <DocNumber value={a.agreementId} to={`/agreements/${a.agreementId}`} />,
            badge: a => <StatusChip status={a.status} />,
            subtitle: a => a.partyName,
            meta: a => [a.siteCode || '', dateOf(a.startDate)],
            actionsPlacement: 'trailing',
          }}
        />
      </Card>
    </div>
  );
}
