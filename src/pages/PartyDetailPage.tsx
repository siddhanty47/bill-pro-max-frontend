/**
 * @fileoverview Party detail view page
 * @description Detail page showing all information for a single party, including
 * contact info, sites, and agreements. Supports Jira-style inline editing for
 * name, contact fields, and notes.
 */
import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetPartyQuery, useUpdatePartyMutation } from '../api/partyApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';

/**
 * Formats an ISO date string for display.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * PartyDetailPage displays the full details of a single party (customer/supplier).
 * Route: /parties/:partyId
 */
export function PartyDetailPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const { currentBusinessId } = useCurrentBusiness();

  const { data: party, isLoading, error, refetch } = useGetPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId },
  );

  const [updateParty, { isLoading: isSaving }] = useUpdatePartyMutation();

  /** Save handler for top-level party fields (e.g. name, notes) */
  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateParty({
        businessId: currentBusinessId!,
        partyId: partyId!,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, partyId, updateParty],
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
    [currentBusinessId, party, partyId, updateParty],
  );

  const sidebar = party ? (
    <DetailSection title="Details">
      <DetailField label="Code" value={party.code} />
      <DetailField label="Roles" value={party.roles.join(', ')} />
      <DetailField
        label="Status"
        value={
          <span className={`status status-${party.isActive ? 'active' : 'inactive'}`}>
            {party.isActive ? 'Active' : 'Inactive'}
          </span>
        }
      />
      <DetailField label="Created" value={formatDate(party.createdAt)} />
      <DetailField label="Updated" value={formatDate(party.updatedAt)} />
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={party?.name || 'Party'}
      subtitle={party?.code ? `Code: ${party.code}` : undefined}
      status={party ? (party.isActive ? 'Active' : 'Inactive') : undefined}
      statusClassName={`status status-${party?.isActive ? 'active' : 'inactive'}`}
      backTo="/parties"
      backLabel="Parties"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {party && (
        <>
          {/* Contact Info */}
          <DetailSection title="Contact Information">
            <DetailField
              label="Name"
              value={party.name}
              editable={{
                rawValue: party.name,
                inputType: 'text',
                onSave: (v) => handleSave('name', v),
                isSaving,
              }}
            />
            <DetailField
              label="Contact Person"
              value={party.contact.person}
              editable={{
                rawValue: party.contact.person,
                inputType: 'text',
                onSave: (v) => handleContactSave('person', v),
                isSaving,
              }}
            />
            <DetailField
              label="Phone"
              value={party.contact.phone}
              editable={{
                rawValue: party.contact.phone,
                inputType: 'text',
                onSave: (v) => handleContactSave('phone', v),
                isSaving,
              }}
            />
            <DetailField
              label="Email"
              value={party.contact.email}
              editable={{
                rawValue: party.contact.email ?? '',
                inputType: 'text',
                onSave: (v) => handleContactSave('email', v),
                isSaving,
              }}
            />
            <DetailField
              label="Address"
              value={party.contact.address}
              editable={{
                rawValue: party.contact.address ?? '',
                inputType: 'text',
                onSave: (v) => handleContactSave('address', v),
                isSaving,
              }}
            />
            <DetailField
              label="GST"
              value={party.contact.gst}
              editable={{
                rawValue: party.contact.gst ?? '',
                inputType: 'text',
                onSave: (v) => handleContactSave('gst', v),
                isSaving,
              }}
            />
          </DetailSection>

          {/* Sites */}
          <DetailSection title={`Sites (${party.sites?.length || 0})`}>
            {party.sites && party.sites.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site Code</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {party.sites.map((site) => (
                    <tr key={site.code}>
                      <td>{site.code}</td>
                      <td>{site.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No sites added yet.</p>
            )}
          </DetailSection>

          {/* Agreements */}
          <DetailSection title={`Agreements (${party.agreements?.length || 0})`}>
            {party.agreements && party.agreements.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agreement ID</th>
                    <th>Site</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {party.agreements.map((agreement) => (
                    <tr key={agreement.agreementId}>
                      <td>
                        <Link
                          to={`/agreements/${agreement.agreementId}`}
                          style={{ color: '#0066cc', textDecoration: 'none' }}
                        >
                          {agreement.agreementId}
                        </Link>
                      </td>
                      <td>{agreement.siteCode}</td>
                      <td>
                        <span className={`status status-${agreement.status}`}>
                          {agreement.status}
                        </span>
                      </td>
                      <td>{formatDate(agreement.startDate)}</td>
                      <td>{formatDate(agreement.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No agreements yet.</p>
            )}
          </DetailSection>

          {/* Notes */}
          <DetailSection title="Notes">
            <DetailField
              label=""
              value={party.notes || undefined}
              emptyText="No notes."
              editable={{
                rawValue: party.notes ?? '',
                inputType: 'textarea',
                onSave: (v) => handleSave('notes', v),
                isSaving,
              }}
            />
          </DetailSection>
        </>
      )}
    </DetailPageShell>
  );
}
