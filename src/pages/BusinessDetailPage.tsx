/**
 * @fileoverview Business detail view page
 * @description Detail page for editing business information including address,
 * contact details, and settings, with inline editing for every field. Built on
 * the kit's detail recipe. Route: /business
 */
import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetBusinessQuery, useUpdateBusinessMutation } from '../api/businessApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { formatDate } from '../utils/format';
import { creditNoteDeadlineSchema, deadlineLabel } from '../utils/financialYear';
import type { BusinessSettings } from '../types';

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'change-history', label: 'Change history' },
];

const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * BusinessDetailPage displays and allows editing of the current business.
 * Route: /business
 */
export function BusinessDetailPage() {
  const { currentBusinessId } = useCurrentBusiness();

  const {
    data: business,
    isLoading,
    error,
    refetch,
  } = useGetBusinessQuery(currentBusinessId || '', { skip: !currentBusinessId });

  const [updateBusiness, { isLoading: isSaving }] = useUpdateBusinessMutation();

  const [activeTab, setActiveTab] = useState('about');

  /** Save handler for top-level business fields */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      if (!currentBusinessId) return;
      await updateBusiness({
        businessId: currentBusinessId,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, updateBusiness]
  );

  /**
   * Save handler for settings fields: sends only the changed setting. The server merges it into
   * the stored settings, so a stale copy of the others never overwrites them.
   */
  const handleSettingsSave = useCallback(
    async (field: keyof BusinessSettings, newValue: string | number) => {
      if (!currentBusinessId) return;
      await updateBusiness({
        businessId: currentBusinessId,
        data: { settings: { [field]: newValue } },
      }).unwrap();
    },
    [currentBusinessId, updateBusiness]
  );

  /** Same rule as the backend; a bad value is shown under the input and never sent */
  const handleDeadlineSave = useCallback(
    async (newValue: string | number) => {
      const parsed = creditNoteDeadlineSchema.safeParse(String(newValue).trim());
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await handleSettingsSave('creditNoteDeadline', parsed.data);
    },
    [handleSettingsSave]
  );

  // Early return must come after every hook (rules-of-hooks).
  if (!currentBusinessId) {
    return <Navigate to="/" replace />;
  }

  const sidebar = business ? (
    <DetailSection title="Details">
      <DetailField label="Created" value={formatDate(business.createdAt)} />
      <DetailField label="Updated" value={formatDate(business.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={business?.name || 'Business'}
      status={business ? (business.isActive ? 'active' : 'inactive') : undefined}
      backTo="/"
      backLabel="Dashboard"
      isLoading={isLoading}
      loadingLabel="Loading business…"
      error={error}
      onRetry={refetch}
      tabs={business ? TABS : undefined}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="business"
      sidebar={sidebar}
    >
      {business && (
        <>
          {activeTab === 'about' && (
            <>
              {/* Contact and address */}
              <DetailSection title="Contact and address">
                <DetailField
                  label="Business name"
                  value={business.name}
                  editable={{
                    rawValue: business.name,
                    inputType: 'text',
                    onSave: v => handleSave('name', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Address"
                  value={business.address}
                  editable={{
                    rawValue: business.address ?? '',
                    inputType: 'textarea',
                    onSave: v => handleSave('address', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Phone"
                  mono
                  value={business.phone}
                  editable={{
                    rawValue: business.phone ?? '',
                    inputType: 'text',
                    onSave: v => handleSave('phone', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Email"
                  value={business.email}
                  editable={{
                    rawValue: business.email ?? '',
                    inputType: 'text',
                    onSave: v => handleSave('email', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="GST"
                  mono
                  value={business.gst}
                  editable={{
                    rawValue: business.gst ?? '',
                    inputType: 'text',
                    onSave: v => handleSave('gst', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="State code"
                  mono
                  value={business.stateCode}
                  editable={{
                    rawValue: business.stateCode ?? '',
                    inputType: 'text',
                    onSave: v => handleSave('stateCode', v),
                    isSaving,
                  }}
                />
              </DetailSection>

              {/* Business settings */}
              <DetailSection title="Business settings">
                <DetailField
                  label="Billing cycle"
                  value={
                    BILLING_CYCLE_OPTIONS.find(o => o.value === business.settings.billingCycle)
                      ?.label ?? business.settings.billingCycle
                  }
                  editable={{
                    rawValue: business.settings.billingCycle,
                    inputType: 'select',
                    options: BILLING_CYCLE_OPTIONS,
                    onSave: v => handleSettingsSave('billingCycle', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Currency"
                  value={business.settings.currency}
                  editable={{
                    rawValue: business.settings.currency,
                    inputType: 'text',
                    onSave: v => handleSettingsSave('currency', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Default SGST (%)"
                  mono
                  value={
                    business.settings.defaultSgstRate != null
                      ? `${business.settings.defaultSgstRate}`
                      : undefined
                  }
                  editable={{
                    rawValue: business.settings.defaultSgstRate ?? 0,
                    inputType: 'number',
                    onSave: v => handleSettingsSave('defaultSgstRate', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Default CGST (%)"
                  mono
                  value={
                    business.settings.defaultCgstRate != null
                      ? `${business.settings.defaultCgstRate}`
                      : undefined
                  }
                  editable={{
                    rawValue: business.settings.defaultCgstRate ?? 0,
                    inputType: 'number',
                    onSave: v => handleSettingsSave('defaultCgstRate', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Default IGST (%)"
                  mono
                  value={
                    business.settings.defaultIgstRate != null
                      ? `${business.settings.defaultIgstRate}`
                      : undefined
                  }
                  editable={{
                    rawValue: business.settings.defaultIgstRate ?? 0,
                    inputType: 'number',
                    onSave: v => handleSettingsSave('defaultIgstRate', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Payment due days"
                  mono
                  value={
                    business.settings.defaultPaymentDueDays != null
                      ? `${business.settings.defaultPaymentDueDays}`
                      : undefined
                  }
                  editable={{
                    rawValue: business.settings.defaultPaymentDueDays ?? 15,
                    inputType: 'number',
                    onSave: v => handleSettingsSave('defaultPaymentDueDays', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Credit note deadline"
                  value={deadlineLabel(business.settings.creditNoteDeadline)}
                  hint="Credit notes are refused after this day following the year's end (GST). Default 30 Nov."
                  editable={{
                    rawValue: business.settings.creditNoteDeadline ?? '11-30',
                    inputType: 'text',
                    onSave: handleDeadlineSave,
                    isSaving,
                  }}
                />
              </DetailSection>
            </>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="business" documentId={currentBusinessId} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
