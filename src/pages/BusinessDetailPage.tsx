/**
 * @fileoverview Business detail view page
 * @description Detail page for editing business information including address,
 * contact details, and settings. Supports Jira-style inline editing for all fields.
 * Route: /business
 */
import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetBusinessQuery,
  useUpdateBusinessMutation,
} from '../api/businessApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { Tabs } from '../components/Tabs';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import type { BusinessSettings } from '../types';

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
 * BusinessDetailPage displays and allows editing of the current business.
 * Route: /business
 */
export function BusinessDetailPage() {
  const { currentBusinessId } = useCurrentBusiness();

  const { data: business, isLoading, error, refetch } = useGetBusinessQuery(
    currentBusinessId || '',
    { skip: !currentBusinessId },
  );

  const [updateBusiness, { isLoading: isSaving }] = useUpdateBusinessMutation();

  const [activeTab, setActiveTab] = useState('about');

  const TABS = [
    { id: 'about', label: 'About' },
    { id: 'change-history', label: 'Change History' },
  ];

  if (!currentBusinessId) {
    return <Navigate to="/" replace />;
  }

  /** Save handler for top-level business fields */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateBusiness({
        businessId: currentBusinessId,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, updateBusiness],
  );

  /** Save handler for settings fields */
  const handleSettingsSave = useCallback(
    async (field: keyof BusinessSettings, newValue: string | number) => {
      if (!business) return;
      const settings: Partial<BusinessSettings> = {
        ...business.settings,
        [field]: newValue,
      };
      await updateBusiness({
        businessId: currentBusinessId,
        data: { settings },
      }).unwrap();
    },
    [currentBusinessId, business, updateBusiness],
  );

  const sidebar = business ? (
    <DetailSection title="Details">
      <DetailField
        label="Status"
        value={
          <span className={`status status-${business.isActive ? 'active' : 'inactive'}`}>
            {business.isActive ? 'Active' : 'Inactive'}
          </span>
        }
      />
      <DetailField label="Created" value={formatDate(business.createdAt)} />
      <DetailField label="Updated" value={formatDate(business.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={business?.name || 'Business'}
      subtitle="Business details and settings"
      status={business ? (business.isActive ? 'Active' : 'Inactive') : undefined}
      statusClassName={`status status-${business?.isActive ? 'active' : 'inactive'}`}
      backTo="/"
      backLabel="Dashboard"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {business && (
        <>
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'about' && (
          <>
          {/* Contact & Address */}
          <DetailSection title="Contact & Address">
            <DetailField
              label="Business Name"
              value={business.name}
              editable={{
                rawValue: business.name,
                inputType: 'text',
                onSave: (v) => handleSave('name', v),
                isSaving,
              }}
            />
            <DetailField
              label="Address"
              value={business.address}
              editable={{
                rawValue: business.address ?? '',
                inputType: 'textarea',
                onSave: (v) => handleSave('address', v),
                isSaving,
              }}
            />
            <DetailField
              label="Phone"
              value={business.phone}
              editable={{
                rawValue: business.phone ?? '',
                inputType: 'text',
                onSave: (v) => handleSave('phone', v),
                isSaving,
              }}
            />
            <DetailField
              label="Email"
              value={business.email}
              editable={{
                rawValue: business.email ?? '',
                inputType: 'text',
                onSave: (v) => handleSave('email', v),
                isSaving,
              }}
            />
            <DetailField
              label="GST"
              value={business.gst}
              editable={{
                rawValue: business.gst ?? '',
                inputType: 'text',
                onSave: (v) => handleSave('gst', v),
                isSaving,
              }}
            />
            <DetailField
              label="State Code"
              value={business.stateCode}
              editable={{
                rawValue: business.stateCode ?? '',
                inputType: 'text',
                onSave: (v) => handleSave('stateCode', v),
                isSaving,
              }}
            />
          </DetailSection>

          {/* Business Settings */}
          <DetailSection title="Business Settings">
            <DetailField
              label="Billing Cycle"
              value={
                BILLING_CYCLE_OPTIONS.find((o) => o.value === business.settings.billingCycle)
                  ?.label ?? business.settings.billingCycle
              }
              editable={{
                rawValue: business.settings.billingCycle,
                inputType: 'select',
                options: BILLING_CYCLE_OPTIONS,
                onSave: (v) => handleSettingsSave('billingCycle', v),
                isSaving,
              }}
            />
            <DetailField
              label="Currency"
              value={business.settings.currency}
              editable={{
                rawValue: business.settings.currency,
                inputType: 'text',
                onSave: (v) => handleSettingsSave('currency', v),
                isSaving,
              }}
            />
            <DetailField
              label="Default SGST (%)"
              value={
                business.settings.defaultSgstRate != null
                  ? `${business.settings.defaultSgstRate}`
                  : undefined
              }
              editable={{
                rawValue: business.settings.defaultSgstRate ?? 0,
                inputType: 'number',
                onSave: (v) => handleSettingsSave('defaultSgstRate', v),
                isSaving,
              }}
            />
            <DetailField
              label="Default CGST (%)"
              value={
                business.settings.defaultCgstRate != null
                  ? `${business.settings.defaultCgstRate}`
                  : undefined
              }
              editable={{
                rawValue: business.settings.defaultCgstRate ?? 0,
                inputType: 'number',
                onSave: (v) => handleSettingsSave('defaultCgstRate', v),
                isSaving,
              }}
            />
            <DetailField
              label="Default IGST (%)"
              value={
                business.settings.defaultIgstRate != null
                  ? `${business.settings.defaultIgstRate}`
                  : undefined
              }
              editable={{
                rawValue: business.settings.defaultIgstRate ?? 0,
                inputType: 'number',
                onSave: (v) => handleSettingsSave('defaultIgstRate', v),
                isSaving,
              }}
            />
            <DetailField
              label="Payment Due Days"
              value={
                business.settings.defaultPaymentDueDays != null
                  ? `${business.settings.defaultPaymentDueDays}`
                  : undefined
              }
              editable={{
                rawValue: business.settings.defaultPaymentDueDays ?? 15,
                inputType: 'number',
                onSave: (v) => handleSettingsSave('defaultPaymentDueDays', v),
                isSaving,
              }}
            />
          </DetailSection>
          </>
          )}

          {activeTab === 'change-history' && <ChangeHistoryTable documentType="business" documentId={currentBusinessId} />}
        </>
      )}
    </DetailPageShell>
  );
}
