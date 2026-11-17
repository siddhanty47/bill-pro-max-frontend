/**
 * @fileoverview Agreement detail view page
 * @description Detail page showing all information for a single agreement,
 * including rates/items, terms, and period dates. Supports Jira-style inline
 * editing for status, dates, terms, and per-item rate values.
 */
import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import styles from './AgreementDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetAgreementQuery,
  useGetAgreementRatesQuery,
  useUpdateAgreementMutation,
  useUpdateAgreementRateMutation,
} from '../api/agreementApi';
import { useGetItemsWithPartyQuery, useGetChallansByAgreementQuery } from '../api/challanApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import { EditableField } from '../components/EditableField';
import {
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  StatusChip,
  type Column,
} from '../components/ui';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { formatDate, formatMoney } from '../utils/format';
import type { AgreementRate, AgreementRateWithItem, Challan, ItemWithParty } from '../types';

/** Status options matching EditAgreementForm */
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

/** Billing cycle options matching EditAgreementForm */
const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Extracts the YYYY-MM-DD portion from an ISO date string for date inputs.
 */
function toDateInputValue(dateStr: string | undefined): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

/**
 * AgreementDetailPage displays the full details of a single rental agreement.
 * Route: /agreements/:agreementId
 */
export function AgreementDetailPage() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const navigate = useNavigate();
  const { currentBusinessId } = useCurrentBusiness();

  const {
    data: agreement,
    isLoading,
    error,
    refetch,
  } = useGetAgreementQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId }
  );

  const { data: rates } = useGetAgreementRatesQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId }
  );

  const { data: itemsAtSite } = useGetItemsWithPartyQuery(
    {
      businessId: currentBusinessId!,
      partyId: agreement?.partyId ?? '',
      agreementId: agreementId!,
    },
    { skip: !currentBusinessId || !agreementId || !agreement?.partyId }
  );

  const { data: challans } = useGetChallansByAgreementQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId }
  );

  const [updateAgreement, { isLoading: isSaving }] = useUpdateAgreementMutation();
  const [updateRate] = useUpdateAgreementRateMutation();

  /** Tracks which rate row is currently being saved */
  const [savingRateItemId, setSavingRateItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('about');

  /**
   * Save handler for top-level agreement fields (status, dates).
   * These go directly into UpdateAgreementInput.
   */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateAgreement({
        businessId: currentBusinessId!,
        agreementId: agreementId!,
        data: { [field]: newValue || undefined },
      }).unwrap();
    },
    [currentBusinessId, agreementId, updateAgreement]
  );

  /**
   * Save handler for nested terms.* fields.
   * Wraps the value under the `terms` key.
   */
  const handleTermsSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateAgreement({
        businessId: currentBusinessId!,
        agreementId: agreementId!,
        data: { terms: { [field]: newValue } },
      }).unwrap();
    },
    [currentBusinessId, agreementId, updateAgreement]
  );

  /**
   * Save handler for an individual rate row's ratePerDay value.
   */
  const handleRateSave = useCallback(
    async (itemId: string, newRate: number) => {
      setSavingRateItemId(itemId);
      try {
        await updateRate({
          businessId: currentBusinessId!,
          agreementId: agreementId!,
          itemId,
          data: { ratePerDay: newRate },
        }).unwrap();
      } finally {
        setSavingRateItemId(null);
      }
    },
    [currentBusinessId, agreementId, updateRate]
  );

  const [savingOpeningBalItemId, setSavingOpeningBalItemId] = useState<string | null>(null);

  const handleOpeningBalanceSave = useCallback(
    async (itemId: string, newBalance: number) => {
      setSavingOpeningBalItemId(itemId);
      try {
        await updateRate({
          businessId: currentBusinessId!,
          agreementId: agreementId!,
          itemId,
          data: { openingBalance: newBalance },
        }).unwrap();
      } finally {
        setSavingOpeningBalItemId(null);
      }
    },
    [currentBusinessId, agreementId, updateRate]
  );

  const tabs = agreement
    ? [
        { id: 'about', label: 'About' },
        { id: 'site-items', label: 'Site items', count: itemsAtSite?.length },
        { id: 'challans', label: 'Challans', count: challans?.length },
        { id: 'change-history', label: 'Change history' },
      ]
    : undefined;

  const optionLabel = (options: { value: string; label: string }[], value: string) =>
    options.find(o => o.value === value)?.label ?? value;

  const sidebar = agreement ? (
    <DetailSection title="Details">
      <DetailField label="Agreement ID" value={agreement.agreementId} mono />
      <DetailField
        label="Party"
        value={
          <Link to={`/parties/${agreement.partyId}`} className="link-accent">
            {agreement.partyName}
          </Link>
        }
      />
      <DetailField label="Site code" value={agreement.siteCode} mono />
      <DetailField label="Created" value={formatDate(agreement.createdAt)} />
    </DetailSection>
  ) : null;

  /** Editable money term (security deposit, cartage, loading charges). */
  const chargeField = (
    label: string,
    field:
      'securityDeposit' | 'deliveryCartage' | 'returnCartage' | 'loadingCharge' | 'unloadingCharge'
  ) => {
    const amount = agreement?.terms[field];
    return (
      <DetailField
        label={label}
        value={amount != null ? formatMoney(amount) : undefined}
        mono
        editable={{
          rawValue: amount,
          inputType: 'number',
          prefix: '₹',
          onSave: v => handleTermsSave(field, v),
          isSaving,
        }}
      />
    );
  };

  // ─── Rates ────────────────────────────────────────────────────────

  const rateCell = (itemId: string, ratePerDay: number) => (
    <EditableField
      label="Rate per day"
      value={ratePerDay}
      displayValue={formatMoney(ratePerDay)}
      inputType="number"
      prefix="₹"
      compact
      mono
      align="right"
      onSave={async v => handleRateSave(itemId, Number(v))}
      isSaving={savingRateItemId === itemId}
    />
  );

  const openingCell = (itemId: string, openingBalance: number) => (
    <EditableField
      label="Opening balance"
      value={openingBalance}
      displayValue={`${openingBalance}`}
      inputType="number"
      compact
      mono
      align="right"
      onSave={async v => handleOpeningBalanceSave(itemId, Number(v))}
      isSaving={savingOpeningBalItemId === itemId}
    />
  );

  const rateColumns: Column<AgreementRateWithItem>[] = [
    { key: 'itemCode', header: 'Code', mono: true, nowrap: true },
    { key: 'itemName', header: 'Item' },
    { key: 'itemCategory', header: 'Category', hideOnMobile: true },
    {
      key: 'ratePerDay',
      header: 'Rate per day',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => rateCell(r.itemId, r.ratePerDay),
    },
    {
      key: 'openingBalance',
      header: 'Opening balance',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => openingCell(r.itemId, r.openingBalance),
    },
  ];

  const baseRateColumns: Column<AgreementRate>[] = [
    { key: 'itemId', header: 'Item ID', mono: true, nowrap: true },
    {
      key: 'ratePerDay',
      header: 'Rate per day',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => rateCell(r.itemId, r.ratePerDay),
    },
    {
      key: 'openingBalance',
      header: 'Opening balance',
      mono: true,
      align: 'right',
      nowrap: true,
      render: r => openingCell(r.itemId, r.openingBalance ?? 0),
    },
  ];

  const rateMeta = (itemId: string, ratePerDay: number, openingBalance: number) => [
    <span key="rate" className={styles.inline}>
      Rate {rateCell(itemId, ratePerDay)}
    </span>,
    <span key="opening" className={styles.inline}>
      Opening {openingCell(itemId, openingBalance)}
    </span>,
  ];

  const emptyRates = <EmptyState title="No items or rates yet" />;
  const rateCount = (rates?.length ? rates : agreement?.rates)?.length ?? 0;

  // ─── Site items ───────────────────────────────────────────────────

  const siteItemColumns: Column<ItemWithParty>[] = [
    { key: 'itemName', header: 'Item' },
    { key: 'quantity', header: 'Quantity at site', mono: true, align: 'right', nowrap: true },
  ];

  // ─── Challans ─────────────────────────────────────────────────────

  const challanLink = (c: Challan) => (
    <DocNumber value={c.challanNumber} to={`/challans/${c._id}`} />
  );

  const challanColumns: Column<Challan>[] = [
    { key: 'challanNumber', header: 'Challan', nowrap: true, render: challanLink },
    { key: 'type', header: 'Type', nowrap: true, render: c => <StatusChip status={c.type} /> },
    { key: 'date', header: 'Date', nowrap: true, render: c => formatDate(c.date) },
    {
      key: 'items',
      header: 'Items',
      mono: true,
      align: 'right',
      nowrap: true,
      render: c => c.items.length,
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: c => <StatusChip status={c.status} />,
    },
  ];

  return (
    <DetailPageShell
      title={agreement?.agreementId || 'Agreement'}
      eyebrow={agreement?.partyName ? `Agreement · ${agreement.partyName}` : 'Agreement'}
      status={agreement?.status}
      backTo="/agreements"
      backLabel="Agreements"
      isLoading={isLoading}
      loadingLabel="Loading agreement…"
      error={error}
      onRetry={refetch}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="agreement"
      sidebar={sidebar}
      headerActions={
        agreement ? (
          <Menu trigger={p => <IconButton label="More actions" icon="more" {...p} />}>
            <MenuLabel>Set status</MenuLabel>
            {STATUS_OPTIONS.filter(o => o.value !== agreement.status).map(o => (
              <MenuItem key={o.value} onSelect={() => handleSave('status', o.value)}>
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        ) : undefined
      }
    >
      {agreement && (
        <>
          {activeTab === 'about' && (
            <>
              <DetailSection title="Period">
                <DetailField
                  label="Start date"
                  value={formatDate(agreement.startDate)}
                  editable={{
                    rawValue: toDateInputValue(agreement.startDate),
                    inputType: 'date',
                    onSave: v => handleSave('startDate', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="End date"
                  value={formatDate(agreement.endDate)}
                  editable={{
                    rawValue: toDateInputValue(agreement.endDate),
                    inputType: 'date',
                    onSave: v => handleSave('endDate', v),
                    isSaving,
                  }}
                />
              </DetailSection>

              <DetailSection title="Terms">
                <DetailField
                  label="Billing cycle"
                  value={optionLabel(BILLING_CYCLE_OPTIONS, agreement.terms.billingCycle)}
                  editable={{
                    rawValue: agreement.terms.billingCycle,
                    inputType: 'select',
                    options: BILLING_CYCLE_OPTIONS,
                    onSave: v => handleTermsSave('billingCycle', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Payment due"
                  value={
                    <>
                      <span className="mono">{agreement.terms.paymentDueDays}</span> days
                    </>
                  }
                  editable={{
                    rawValue: agreement.terms.paymentDueDays,
                    inputType: 'number',
                    suffix: ' days',
                    onSave: v => handleTermsSave('paymentDueDays', v),
                    isSaving,
                  }}
                />
                {chargeField('Security deposit', 'securityDeposit')}
                {chargeField('Delivery cartage', 'deliveryCartage')}
                {chargeField('Return cartage', 'returnCartage')}
                {chargeField('Loading charge', 'loadingCharge')}
                {chargeField('Unloading charge', 'unloadingCharge')}
              </DetailSection>

              <Card title="Items and rates" count={rateCount} padded={false}>
                {rates && rates.length > 0 ? (
                  <DataTable
                    aria-label="Items and rates"
                    columns={rateColumns}
                    rows={rates}
                    rowKey={r => r.itemId}
                    empty={emptyRates}
                    mobile={{
                      title: r => r.itemName,
                      subtitle: r => r.itemCode,
                      meta: r => rateMeta(r.itemId, r.ratePerDay, r.openingBalance),
                    }}
                  />
                ) : (
                  <DataTable
                    aria-label="Items and rates"
                    columns={baseRateColumns}
                    rows={agreement.rates ?? []}
                    rowKey={r => r.itemId}
                    empty={emptyRates}
                    mobile={{
                      title: r => r.itemId,
                      meta: r => rateMeta(r.itemId, r.ratePerDay, r.openingBalance ?? 0),
                    }}
                  />
                )}
              </Card>
            </>
          )}

          {activeTab === 'site-items' && (
            <Card title="Items at site" count={itemsAtSite?.length} padded={false}>
              <DataTable
                aria-label="Items at site"
                columns={siteItemColumns}
                rows={itemsAtSite ?? []}
                rowKey={i => i.itemId}
                empty={<EmptyState title="No items at this site" />}
                mobile={{
                  title: i => i.itemName,
                  meta: i => [
                    <span key="qty">
                      Qty <span className="mono">{i.quantity}</span>
                    </span>,
                  ],
                }}
              />
            </Card>
          )}

          {activeTab === 'challans' && (
            <Card title="Challans" count={challans?.length} padded={false}>
              <DataTable
                aria-label="Challans"
                columns={challanColumns}
                rows={challans ?? []}
                rowKey={c => c._id}
                onRowClick={c => navigate(`/challans/${c._id}`)}
                empty={<EmptyState title="No challans yet" />}
                mobile={{
                  title: challanLink,
                  badge: c => <StatusChip status={c.status} />,
                  subtitle: c => (c.type === 'delivery' ? 'Delivery' : 'Return'),
                  meta: c => [
                    formatDate(c.date),
                    <span key="items">
                      <span className="mono">{c.items.length}</span> items
                    </span>,
                  ],
                }}
              />
            </Card>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="agreement" documentId={agreementId!} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
