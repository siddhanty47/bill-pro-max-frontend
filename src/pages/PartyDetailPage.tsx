/**
 * @fileoverview Party detail view page
 * @description Detail page for a single party: contact and notes (inline-editable),
 * sites and agreements, bills, payments, statements, share links and change history,
 * one tab each. The reference detail page for the kit's detail recipe:
 * DetailPageShell (status once, tabs with counts, sidebar) + DetailSection /
 * DetailField rows + kit Cards holding DataTables.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './PartyDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetPartyQuery,
  useGetOutstandingSummaryQuery,
  useGetPartyOutstandingBySiteQuery,
  useUpdatePartyMutation,
  useCreateAgreementMutation,
  useUpdateSiteMutation,
} from '../api/partyApi';
import { useGetBillsByPartyQuery } from '../api/billApi';
import { useGetPaymentsByPartyQuery } from '../api/paymentApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { useLazyGetStatementPdfQuery, useLazyGetStatementDataQuery } from '../api/statementApi';
import { StatementPreview } from '../components/statements/StatementPreview';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  StatusChip,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type Column,
} from '../components/ui';
import { DEFAULT_SITE_LABEL, DEFAULT_SITE_PARAM } from '../utils/sites';
import { AddSiteModal } from '../components/AddSiteModal';
import { AgreementForm } from '../components/forms/AgreementForm';
import { getErrorMessage } from '../api/baseApi';
import { ShareLinkManager } from '../components/ShareLinkManager';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { EditableField } from '../components/EditableField';
import { formatDate, formatMoney } from '../utils/format';
import type { Agreement, Bill, CreateAgreementInput, Payment, Site } from '../types';

type StatementType = 'ledger' | 'bills' | 'items' | 'aging';

/** Says why Preview / Download PDF are disabled. */
const STATEMENT_REASON_ID = 'party-statement-reason';

/** "client" → "Client"; "bank_transfer" → "Bank transfer". */
const sentence = (s: string) => {
  const words = s.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The date a bill is listed and sorted by (legacy bills have no billDate). */
const billSortDate = (b: Bill) => b.billDate ?? b.billingPeriod?.start ?? b.createdAt ?? '';
const billShownDate = (b: Bill) => b.billDate ?? b.billingPeriod?.end ?? b.createdAt;

/** Statement scope select value → query params: '' whole party, 'site:<code>', 'agreement:<id>' */
function scopeParams(scope: string): { agreementId?: string; siteCode?: string } {
  if (scope.startsWith('site:')) return { siteCode: scope.slice(5) };
  if (scope.startsWith('agreement:')) return { agreementId: scope.slice(10) };
  return {};
}

/**
 * PartyDetailPage displays the full details of a single party (customer/supplier).
 * Route: /parties/:partyId
 */
export function PartyDetailPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();

  const {
    data: party,
    isLoading,
    error,
    refetch,
  } = useGetPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId }
  );

  const [updateParty, { isLoading: isSaving }] = useUpdatePartyMutation();
  const [createAgreement, { isLoading: isCreatingAgreement }] = useCreateAgreementMutation();
  const [updateSite, { isLoading: isUpdatingSite }] = useUpdateSiteMutation();

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [billSiteFilter, setBillSiteFilter] = useState('');

  // Statement PDF state
  const [statementType, setStatementType] = useState<StatementType>('ledger');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [statementScope, setStatementScope] = useState('');
  const [triggerStatementPdf, { isFetching: isDownloadingStatement }] =
    useLazyGetStatementPdfQuery();
  const [triggerStatementData, { data: previewData, isFetching: isLoadingPreview }] =
    useLazyGetStatementDataQuery();
  const hasStatementDates = !!statementFrom && !!statementTo;

  const { data: bills } = useGetBillsByPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId }
  );

  const { data: payments } = useGetPaymentsByPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId }
  );

  // Ledger-style outstanding (opening balance + bills - payments) for this party
  const { data: bySite } = useGetPartyOutstandingBySiteQuery(
    { businessId: currentBusinessId || '', partyId: partyId || '' },
    { skip: !currentBusinessId || !partyId }
  );
  const { data: outstandingSummary } = useGetOutstandingSummaryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });
  const outstanding = outstandingSummary
    ? (outstandingSummary.parties.find(p => p.partyId === partyId)?.outstanding ?? 0)
    : undefined;

  const [activeTab, setActiveTab] = useState('about');

  /** Save handler for top-level party fields (e.g. name, notes) */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateParty({
        businessId: currentBusinessId!,
        partyId: partyId!,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, partyId, updateParty]
  );

  /**
   * Save handler for nested contact.* fields.
   * Spreads the existing contact object and overrides the changed field.
   */
  const handleContactSave = useCallback(
    async (field: string, newValue: string | number) => {
      if (!party) return;
      await updateParty({
        businessId: currentBusinessId!,
        partyId: partyId!,
        data: { contact: { ...party.contact, [field]: newValue } },
      }).unwrap();
    },
    [currentBusinessId, party, partyId, updateParty]
  );

  /** Save handler for one site's address or state code */
  const handleSiteSave = useCallback(
    async (siteCode: string, data: { address?: string; stateCode?: string }) => {
      await updateSite({
        businessId: currentBusinessId!,
        partyId: partyId!,
        siteCode,
        data,
      }).unwrap();
    },
    [currentBusinessId, partyId, updateSite]
  );

  /** Submit handler for the agreement creation modal */
  const handleAgreementSubmit = useCallback(
    async (data: CreateAgreementInput) => {
      try {
        await createAgreement({
          businessId: currentBusinessId!,
          partyId: partyId!,
          data,
        }).unwrap();
        setIsAgreementModalOpen(false);
      } catch (err) {
        alert(getErrorMessage(err));
      }
    },
    [createAgreement, currentBusinessId, partyId]
  );

  const handleDownloadStatement = useCallback(async () => {
    if (!currentBusinessId || !partyId || !statementFrom || !statementTo) return;
    try {
      const blob = await triggerStatementPdf({
        businessId: currentBusinessId,
        partyId,
        type: statementType,
        from: statementFrom,
        to: statementTo,
        ...scopeParams(statementScope),
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${statementType}-statement.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [
    currentBusinessId,
    partyId,
    statementType,
    statementFrom,
    statementTo,
    statementScope,
    triggerStatementPdf,
  ]);

  const handlePreviewStatement = useCallback(async () => {
    if (!currentBusinessId || !partyId || !statementFrom || !statementTo) return;
    try {
      await triggerStatementData({
        businessId: currentBusinessId,
        partyId,
        type: statementType,
        from: statementFrom,
        to: statementTo,
        ...scopeParams(statementScope),
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }, [
    currentBusinessId,
    partyId,
    statementType,
    statementFrom,
    statementTo,
    statementScope,
    triggerStatementData,
  ]);

  const sites = useMemo(() => party?.sites ?? [], [party]);
  const hasSiteSplit = (party?.openingBalanceSites ?? []).some(r => r.siteCode !== null);
  const agreements = useMemo(() => party?.agreements ?? [], [party]);

  const agreementSite = useMemo(
    () => Object.fromEntries(agreements.map(a => [a.agreementId, a.siteCode])),
    [agreements]
  );

  /** Bills for the chosen site, newest first */
  const shownBills = useMemo(
    () =>
      (bills ?? [])
        .filter(b => billSiteFilter === '' || agreementSite[b.agreementId] === billSiteFilter)
        .sort((a, b) => new Date(billSortDate(b)).getTime() - new Date(billSortDate(a)).getTime()),
    [bills, billSiteFilter, agreementSite]
  );

  /** Payments, newest first */
  const shownPayments = useMemo(
    () =>
      [...(payments ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments]
  );

  // ─── Sites & agreements ───────────────────────────────────────────

  const siteAddress = (site: Site) => (
    <EditableField
      label="Address"
      value={site.address}
      inputType="text"
      compact
      onSave={v => handleSiteSave(site.code, { address: String(v).trim() })}
      isSaving={isUpdatingSite}
    />
  );

  const siteStateCode = (site: Site) => (
    <EditableField
      label="State code"
      value={site.stateCode ?? ''}
      inputType="text"
      compact
      mono
      onSave={v => handleSiteSave(site.code, { stateCode: String(v).trim() || undefined })}
      isSaving={isUpdatingSite}
    />
  );

  const siteColumns: Column<Site>[] = [
    { key: 'code', header: 'Code', mono: true, nowrap: true },
    { key: 'address', header: 'Address', render: siteAddress },
    { key: 'stateCode', header: 'State code', nowrap: true, render: siteStateCode },
  ];

  const agreementLink = (a: Agreement) => (
    <DocNumber value={a.agreementId} to={`/agreements/${a.agreementId}`} />
  );

  const agreementColumns: Column<Agreement>[] = [
    { key: 'agreementId', header: 'Agreement', nowrap: true, render: agreementLink },
    { key: 'siteCode', header: 'Site', mono: true, nowrap: true },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: a => <StatusChip status={a.status} />,
    },
    { key: 'start', header: 'Start', nowrap: true, render: a => formatDate(a.startDate) },
    { key: 'end', header: 'End', nowrap: true, render: a => formatDate(a.endDate) },
  ];

  // ─── Bills ────────────────────────────────────────────────────────

  const billLink = (b: Bill) => <DocNumber value={b.billNumber} to={`/bills/${b._id}`} />;
  const billAgreement = (b: Bill) =>
    agreementSite[b.agreementId]
      ? `${b.agreementId} / ${agreementSite[b.agreementId]}`
      : b.agreementId;
  const billPeriod = (b: Bill) =>
    b.billingPeriod
      ? `${formatDate(b.billingPeriod.start)} – ${formatDate(b.billingPeriod.end)}`
      : '';

  const billColumns: Column<Bill>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: b => formatDate(billShownDate(b)) },
    { key: 'billNumber', header: 'Bill', nowrap: true, render: billLink },
    {
      key: 'agreement',
      header: 'Agreement / site',
      mono: true,
      nowrap: true,
      render: billAgreement,
    },
    {
      key: 'period',
      header: 'Period',
      nowrap: true,
      hideOnMobile: true,
      render: billPeriod,
    },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: b => formatMoney(b.totalAmount),
    },
  ];

  // ─── Payments ─────────────────────────────────────────────────────

  const paymentBill = (p: Payment) =>
    p.billId ? (
      <Button size="sm" variant="ghost" to={`/bills/${p.billId}`}>
        View bill
      </Button>
    ) : null;

  const billById = useMemo(() => new Map((bills ?? []).map(b => [b._id, b])), [bills]);
  /** A payment's site: its own, else its bill's, else the default site */
  const paymentSite = (p: Payment) => {
    const billAgreement = p.billId ? billById.get(p.billId)?.agreementId : undefined;
    const code = p.siteCode ?? (billAgreement ? agreementSite[billAgreement] : undefined);
    return code ? <span className="mono">{code}</span> : DEFAULT_SITE_LABEL;
  };

  const paymentColumns: Column<Payment>[] = [
    { key: 'date', header: 'Date', nowrap: true, render: p => formatDate(p.date) },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: p => formatMoney(p.amount),
    },
    { key: 'method', header: 'Method', nowrap: true, render: p => sentence(p.method) },
    { key: 'bill', header: 'Bill', nowrap: true, render: paymentBill },
    { key: 'site', header: 'Site', nowrap: true, hideOnMobile: true, render: paymentSite },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: p => <StatusChip status={p.status} />,
    },
    { key: 'reference', header: 'Reference', mono: true, hideOnMobile: true },
  ];

  // ─── Shell ────────────────────────────────────────────────────────

  const tabs = party
    ? [
        { id: 'about', label: 'About' },
        { id: 'sites-agreements', label: 'Sites & agreements', count: sites.length },
        { id: 'bills', label: 'Bills', count: bills?.length },
        { id: 'payments', label: 'Payments', count: payments?.length },
        { id: 'statements', label: 'Statements' },
        { id: 'share-links', label: 'Share links' },
        { id: 'change-history', label: 'Change history' },
      ]
    : undefined;

  const sidebar = party ? (
    <DetailSection title="Details">
      <DetailField label="Code" value={party.code} mono />
      <DetailField label="Roles" value={party.roles.map(sentence).join(', ')} />
      <DetailField label="Created" value={formatDate(party.createdAt)} />
      <DetailField label="Updated" value={formatDate(party.updatedAt)} />
    </DetailSection>
  ) : null;

  const contactField = (
    label: string,
    field: 'person' | 'phone' | 'email' | 'address' | 'gst' | 'stateCode',
    mono = false
  ) =>
    party && (
      <DetailField
        label={label}
        value={party.contact[field]}
        mono={mono}
        editable={{
          rawValue: party.contact[field] ?? '',
          inputType: 'text',
          onSave: v => handleContactSave(field, v),
          isSaving,
        }}
      />
    );

  return (
    <DetailPageShell
      recordNoun="party"
      title={party?.name || 'Party'}
      status={party ? (party.isActive ? 'active' : 'inactive') : undefined}
      backTo="/parties"
      backLabel="Parties"
      isLoading={isLoading}
      loadingLabel="Loading party…"
      error={error}
      onRetry={refetch}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="party"
      sidebar={sidebar}
    >
      {party && (
        <>
          {activeTab === 'about' && (
            <>
              <DetailSection title="Contact">
                <DetailField
                  label="Name"
                  value={party.name}
                  editable={{
                    rawValue: party.name,
                    inputType: 'text',
                    onSave: v => handleSave('name', v),
                    isSaving,
                  }}
                />
                {contactField('Contact person', 'person')}
                {contactField('Phone', 'phone', true)}
                {contactField('Email', 'email')}
                {contactField('Address', 'address')}
                {contactField('GST', 'gst', true)}
                {contactField('State code', 'stateCode', true)}
              </DetailSection>

              <DetailSection title="Balance">
                <DetailField
                  label="Outstanding"
                  value={outstanding != null ? formatMoney(outstanding) : undefined}
                  mono
                />
                <DetailField
                  label="Opening balance"
                  value={party.openingBalance ? formatMoney(party.openingBalance) : undefined}
                  mono
                  // A bare total lands on the default site; a split across sites is edited in the form
                  editable={
                    hasSiteSplit
                      ? undefined
                      : {
                          rawValue: party.openingBalance ?? 0,
                          inputType: 'number',
                          prefix: '₹',
                          onSave: v => handleSave('openingBalance', v),
                          isSaving,
                        }
                  }
                />
                <DetailField
                  label="Opening balance as of"
                  value={
                    party.openingBalanceDate ? formatDate(party.openingBalanceDate) : undefined
                  }
                  editable={{
                    rawValue: party.openingBalanceDate?.split('T')[0] ?? '',
                    inputType: 'date',
                    onSave: v => handleSave('openingBalanceDate', v),
                    isSaving,
                  }}
                />
              </DetailSection>

              {bySite && bySite.sites.length > 0 && (
                <Card title="Outstanding by site" padded={false}>
                  <Table aria-label="Outstanding by site">
                    <THead>
                      <Tr>
                        <Th>Site</Th>
                        <Th align="right" hideOnMobile>
                          Opening
                        </Th>
                        <Th align="right" hideOnMobile>
                          Billed
                        </Th>
                        <Th align="right" hideOnMobile>
                          Received
                        </Th>
                        <Th align="right">Outstanding</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {bySite.sites.map(row => (
                        <Tr key={row.siteCode ?? '@default'}>
                          <Td>
                            {row.isDefault ? (
                              DEFAULT_SITE_LABEL
                            ) : (
                              <>
                                <span className="mono">{row.siteCode}</span> {row.address}
                              </>
                            )}
                          </Td>
                          <Td align="right" mono nowrap hideOnMobile>
                            {formatMoney(row.opening)}
                          </Td>
                          <Td align="right" mono nowrap hideOnMobile>
                            {formatMoney(row.billed)}
                          </Td>
                          <Td align="right" mono nowrap hideOnMobile>
                            {formatMoney(row.received)}
                          </Td>
                          <Td align="right" mono nowrap>
                            {formatMoney(row.outstanding)}
                          </Td>
                        </Tr>
                      ))}
                      <Tr variant="total">
                        <Td>Total</Td>
                        <Td align="right" mono nowrap hideOnMobile>
                          {formatMoney(bySite.total.opening)}
                        </Td>
                        <Td align="right" mono nowrap hideOnMobile>
                          {formatMoney(bySite.total.billed)}
                        </Td>
                        <Td align="right" mono nowrap hideOnMobile>
                          {formatMoney(bySite.total.received)}
                        </Td>
                        <Td align="right" mono nowrap>
                          {formatMoney(bySite.total.outstanding)}
                        </Td>
                      </Tr>
                    </TBody>
                  </Table>
                </Card>
              )}

              <DetailSection title="Notes">
                <DetailField
                  label=""
                  value={party.notes || undefined}
                  editable={{
                    rawValue: party.notes ?? '',
                    inputType: 'textarea',
                    onSave: v => handleSave('notes', v),
                    isSaving,
                  }}
                />
              </DetailSection>
            </>
          )}

          {activeTab === 'sites-agreements' && (
            <>
              <Card
                title="Sites"
                count={sites.length}
                padded={false}
                actions={
                  <Button size="sm" icon="plus" onClick={() => setIsSiteModalOpen(true)}>
                    Add site
                  </Button>
                }
              >
                <DataTable
                  aria-label="Sites"
                  columns={siteColumns}
                  rows={sites}
                  rowKey={s => s.code}
                  empty={<EmptyState title="No sites yet" />}
                  mobile={{
                    title: s => <span className="mono">{s.code}</span>,
                    subtitle: siteAddress,
                    meta: s => [
                      <span key="state" className={styles.inline}>
                        State code {siteStateCode(s)}
                      </span>,
                    ],
                  }}
                />
              </Card>

              <Card
                title="Agreements"
                count={agreements.length}
                padded={false}
                actions={
                  <Button size="sm" icon="plus" onClick={() => setIsAgreementModalOpen(true)}>
                    Add agreement
                  </Button>
                }
              >
                <DataTable
                  aria-label="Agreements"
                  columns={agreementColumns}
                  rows={agreements}
                  rowKey={a => a.agreementId}
                  onRowClick={a => navigate(`/agreements/${a.agreementId}`)}
                  empty={<EmptyState title="No agreements yet" />}
                  mobile={{
                    title: agreementLink,
                    badge: a => <StatusChip status={a.status} />,
                    meta: a => [
                      <span key="site" className="mono">
                        {a.siteCode}
                      </span>,
                      a.endDate
                        ? `${formatDate(a.startDate)} – ${formatDate(a.endDate)}`
                        : `From ${formatDate(a.startDate)}`,
                    ],
                  }}
                />
              </Card>
            </>
          )}

          {activeTab === 'bills' && (
            <Card
              title="Bills"
              count={shownBills.length}
              padded={false}
              actions={
                sites.length > 0 && (
                  <div className={styles.siteFilter}>
                    <Select
                      aria-label="Site"
                      value={billSiteFilter}
                      onChange={e => setBillSiteFilter(e.target.value)}
                    >
                      <option value="">All sites</option>
                      {sites.map(s => (
                        <option key={s.code} value={s.code}>
                          {s.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                )
              }
            >
              <DataTable
                aria-label="Bills"
                columns={billColumns}
                rows={shownBills}
                rowKey={b => b._id}
                onRowClick={b => navigate(`/bills/${b._id}`)}
                empty={<EmptyState title="No bills yet" />}
                mobile={{
                  title: billLink,
                  subtitle: billAgreement,
                  meta: b => [
                    formatDate(billShownDate(b)),
                    <span key="amount" className="mono">
                      {formatMoney(b.totalAmount)}
                    </span>,
                  ],
                }}
              />
            </Card>
          )}

          {activeTab === 'payments' && (
            <Card title="Payments" count={shownPayments.length} padded={false}>
              <DataTable
                aria-label="Payments"
                columns={paymentColumns}
                rows={shownPayments}
                rowKey={p => p._id}
                onRowClick={p => navigate(`/payments/${p._id}`)}
                empty={<EmptyState title="No payments yet" />}
                mobile={{
                  title: p => <span className="mono">{formatMoney(p.amount)}</span>,
                  badge: p => <StatusChip status={p.status} />,
                  meta: p => [
                    formatDate(p.date),
                    sentence(p.method),
                    p.reference && (
                      <span key="ref" className="mono">
                        {p.reference}
                      </span>
                    ),
                  ],
                  actions: paymentBill,
                }}
              />
            </Card>
          )}

          {activeTab === 'statements' && (
            <>
              <Card title="Statements">
                <div className={styles.statementFields}>
                  <Field label="Type">
                    <Select
                      value={statementType}
                      onChange={e => setStatementType(e.target.value as StatementType)}
                    >
                      <option value="ledger">Ledger</option>
                      <option value="bills">Bills</option>
                      <option value="items">Items</option>
                      <option value="aging">Aging / outstanding</option>
                    </Select>
                  </Field>
                  <Field label="From">
                    <Input
                      type="date"
                      value={statementFrom}
                      onChange={e => setStatementFrom(e.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      type="date"
                      value={statementTo}
                      onChange={e => setStatementTo(e.target.value)}
                    />
                  </Field>
                  <Field label="Site or agreement">
                    <Select
                      value={statementScope}
                      onChange={e => setStatementScope(e.target.value)}
                    >
                      <option value="">Whole party</option>
                      <optgroup label="Sites">
                        <option value={`site:${DEFAULT_SITE_PARAM}`}>{DEFAULT_SITE_LABEL}</option>
                        {sites.map(s => (
                          <option key={s.code} value={`site:${s.code}`}>
                            {s.code}
                          </option>
                        ))}
                      </optgroup>
                      {agreements.length > 0 && (
                        <optgroup label="Agreements">
                          {agreements.map(a => (
                            <option key={a.agreementId} value={`agreement:${a.agreementId}`}>
                              {a.agreementId} ({a.siteCode})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </Field>
                </div>
                <div className={styles.statementActions}>
                  <Button
                    onClick={handlePreviewStatement}
                    loading={isLoadingPreview}
                    disabled={!hasStatementDates}
                    aria-describedby={hasStatementDates ? undefined : STATEMENT_REASON_ID}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDownloadStatement}
                    loading={isDownloadingStatement}
                    disabled={!hasStatementDates}
                    aria-describedby={hasStatementDates ? undefined : STATEMENT_REASON_ID}
                  >
                    Download PDF
                  </Button>
                  {!hasStatementDates && (
                    <span id={STATEMENT_REASON_ID} className={styles.reason}>
                      Pick both dates
                    </span>
                  )}
                </div>
              </Card>
              {previewData && <StatementPreview data={previewData} />}
            </>
          )}

          {activeTab === 'share-links' && <ShareLinkManager partyId={partyId!} sites={sites} />}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="party" documentId={partyId!} />
          )}

          {currentBusinessId && (
            <AddSiteModal
              isOpen={isSiteModalOpen}
              onClose={() => setIsSiteModalOpen(false)}
              businessId={currentBusinessId}
              party={party}
            />
          )}

          <Modal
            isOpen={isAgreementModalOpen}
            onClose={() => setIsAgreementModalOpen(false)}
            title={`Add agreement for ${party.name}`}
            size="form"
          >
            <AgreementForm
              inventoryItems={inventory || []}
              sites={sites}
              existingAgreements={agreements}
              onSubmit={handleAgreementSubmit}
              onCancel={() => setIsAgreementModalOpen(false)}
              isLoading={isCreatingAgreement}
            />
          </Modal>
        </>
      )}
    </DetailPageShell>
  );
}
