/**
 * @fileoverview Agreement detail view page
 * @description Detail page showing all information for a single agreement,
 * including rates/items, terms, and period dates. Supports Jira-style inline
 * editing for status, dates, terms, and per-item rate values.
 */
import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetAgreementQuery,
  useGetAgreementRatesQuery,
  useUpdateAgreementMutation,
  useUpdateAgreementRateMutation,
} from '../api/agreementApi';
import { useGetItemsWithPartyQuery, useGetChallansByAgreementQuery } from '../api/challanApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { EditableField } from '../components/EditableField';

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
 * Formats an ISO date string for display.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

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
  const { currentBusinessId } = useCurrentBusiness();

  const { data: agreement, isLoading, error, refetch } = useGetAgreementQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId },
  );

  const { data: rates } = useGetAgreementRatesQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId },
  );

  const { data: itemsAtSite } = useGetItemsWithPartyQuery(
    { businessId: currentBusinessId!, partyId: agreement?.partyId ?? '', agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId || !agreement?.partyId },
  );

  const { data: challans } = useGetChallansByAgreementQuery(
    { businessId: currentBusinessId!, agreementId: agreementId! },
    { skip: !currentBusinessId || !agreementId },
  );

  const [updateAgreement, { isLoading: isSaving }] = useUpdateAgreementMutation();
  const [updateRate] = useUpdateAgreementRateMutation();

  /** Tracks which rate row is currently being saved */
  const [savingRateItemId, setSavingRateItemId] = useState<string | null>(null);

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
    [currentBusinessId, agreementId, updateAgreement],
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
    [currentBusinessId, agreementId, updateAgreement],
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
    [currentBusinessId, agreementId, updateRate],
  );

  const sidebar = agreement ? (
    <DetailSection title="Details">
      <DetailField label="Agreement ID" value={agreement.agreementId} />
      <DetailField
        label="Party"
        value={
          <Link
            to={`/parties/${agreement.partyId}`}
            style={{ color: '#0066cc', textDecoration: 'none' }}
          >
            {agreement.partyName}
          </Link>
        }
      />
      <DetailField label="Site Code" value={agreement.siteCode} />

      {/* Editable: Status */}
      <DetailField
        label="Status"
        value={
          <span className={`status status-${agreement.status}`}>
            {agreement.status}
          </span>
        }
        editable={{
          rawValue: agreement.status,
          inputType: 'select',
          options: STATUS_OPTIONS,
          onSave: (v) => handleSave('status', v),
          isSaving,
        }}
      />

      {/* Editable: Billing Cycle */}
      <DetailField
        label="Billing Cycle"
        value={agreement.terms.billingCycle}
        editable={{
          rawValue: agreement.terms.billingCycle,
          inputType: 'select',
          options: BILLING_CYCLE_OPTIONS,
          onSave: (v) => handleTermsSave('billingCycle', v),
          isSaving,
        }}
      />

      {/* Editable: Payment Due Days */}
      <DetailField
        label="Payment Due"
        value={`${agreement.terms.paymentDueDays} days`}
        editable={{
          rawValue: agreement.terms.paymentDueDays,
          inputType: 'number',
          suffix: ' days',
          onSave: (v) => handleTermsSave('paymentDueDays', v),
          isSaving,
        }}
      />

      {/* Editable: Security Deposit */}
      <DetailField
        label="Security Deposit"
        value={
          agreement.terms.securityDeposit != null
            ? `₹${agreement.terms.securityDeposit.toLocaleString()}`
            : undefined
        }
        editable={{
          rawValue: agreement.terms.securityDeposit,
          inputType: 'number',
          prefix: '₹',
          onSave: (v) => handleTermsSave('securityDeposit', v),
          isSaving,
        }}
      />

      <DetailField label="Created" value={formatDate(agreement.createdAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={agreement?.agreementId || 'Agreement'}
      subtitle={agreement?.partyName ? `Party: ${agreement.partyName}` : undefined}
      status={agreement?.status}
      statusClassName={`status status-${agreement?.status}`}
      backTo="/agreements"
      backLabel="Agreements"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {agreement && (
        <>
          {/* Period — editable dates */}
          <DetailSection title="Agreement Period">
            <DetailField
              label="Start Date"
              value={formatDate(agreement.startDate)}
              editable={{
                rawValue: toDateInputValue(agreement.startDate),
                inputType: 'date',
                onSave: (v) => handleSave('startDate', v),
                isSaving,
              }}
            />
            <DetailField
              label="End Date"
              value={formatDate(agreement.endDate)}
              editable={{
                rawValue: toDateInputValue(agreement.endDate),
                inputType: 'date',
                onSave: (v) => handleSave('endDate', v),
                isSaving,
              }}
            />
          </DetailSection>

          {/* Items / Rates — each rate row has an editable Rate/Day column */}
          <DetailSection title={`Items & Rates (${(rates || agreement.rates || []).length})`}>
            {rates && rates.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Rate/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.itemId}>
                      <td>{rate.itemCode}</td>
                      <td>{rate.itemName}</td>
                      <td>{rate.itemCategory}</td>
                      <td style={{ padding: 0 }}>
                        <EditableField
                          label=""
                          value={rate.ratePerDay}
                          displayValue={`₹${rate.ratePerDay}`}
                          inputType="number"
                          prefix="₹"
                          onSave={async (v) => handleRateSave(rate.itemId, Number(v))}
                          isSaving={savingRateItemId === rate.itemId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : agreement.rates && agreement.rates.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                    <th>Rate/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {agreement.rates.map((rate) => (
                    <tr key={rate.itemId}>
                      <td>{rate.itemId}</td>
                      <td style={{ padding: 0 }}>
                        <EditableField
                          label=""
                          value={rate.ratePerDay}
                          displayValue={`₹${rate.ratePerDay}`}
                          inputType="number"
                          prefix="₹"
                          onSave={async (v) => handleRateSave(rate.itemId, Number(v))}
                          isSaving={savingRateItemId === rate.itemId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No items/rates configured.</p>
            )}
          </DetailSection>

          {/* Items currently deployed at the site under this agreement */}
          <DetailSection title={`Items at Site (${itemsAtSite?.length || 0})`}>
            {itemsAtSite && itemsAtSite.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity at Site</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsAtSite.map((item) => (
                    <tr key={item.itemId}>
                      <td>{item.itemName}</td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No items currently at site.</p>
            )}
          </DetailSection>

          {/* Challans linked to this agreement */}
          <DetailSection title={`Challans (${challans?.length || 0})`}>
            {challans && challans.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Challan #</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.map((challan) => (
                    <tr key={challan._id}>
                      <td>
                        <Link
                          to={`/challans/${challan._id}`}
                          style={{ color: '#0066cc', textDecoration: 'none' }}
                        >
                          {challan.challanNumber}
                        </Link>
                      </td>
                      <td>
                        <span className={`status status-${challan.type === 'delivery' ? 'active' : 'pending'}`}>
                          {challan.type}
                        </span>
                      </td>
                      <td>{formatDate(challan.date)}</td>
                      <td>{challan.items.length}</td>
                      <td>
                        <span className={`status status-${challan.status}`}>
                          {challan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No challans yet.</p>
            )}
          </DetailSection>
        </>
      )}
    </DetailPageShell>
  );
}
