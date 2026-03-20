/**
 * @fileoverview Party detail view page
 * @description Detail page showing all information for a single party, including
 * contact info, sites, and agreements. Supports Jira-style inline editing for
 * name, contact fields, notes, and site details. Provides modals to add new
 * sites and agreements, reusing the same components as the list page.
 */
import { useCallback, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import pageStyles from './PartyDetailPage.module.css';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetPartyQuery,
  useUpdatePartyMutation,
  useCreateAgreementMutation,
  useUpdateSiteMutation,
} from '../api/partyApi';
import { useGetBillsByPartyQuery } from '../api/billApi';
import { useGetPaymentsByPartyQuery } from '../api/paymentApi';
import { useGetInventoryQuery } from '../api/inventoryApi';
import { useLazyGetStatementPdfQuery } from '../api/statementApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { Modal } from '../components/Modal';
import { Tabs } from '../components/Tabs';
import { AddSiteModal } from '../components/AddSiteModal';
import { AgreementForm } from '../components/forms/AgreementForm';
import { getErrorMessage } from '../api/baseApi';
import { ShareLinkManager } from '../components/ShareLinkManager';
import type { CreateAgreementInput, Site } from '../types';

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
  const [createAgreement, { isLoading: isCreatingAgreement }] = useCreateAgreementMutation();
  const [updateSite, { isLoading: isUpdatingSite }] = useUpdateSiteMutation();

  const { data: inventory } = useGetInventoryQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [billSiteFilter, setBillSiteFilter] = useState('');

  // Statement PDF state
  const [statementType, setStatementType] = useState<'ledger' | 'bills' | 'items' | 'aging'>('ledger');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [statementAgreementId, setStatementAgreementId] = useState('');
  const [triggerStatementPdf, { isFetching: isDownloadingStatement }] = useLazyGetStatementPdfQuery();

  const { data: bills } = useGetBillsByPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId },
  );

  const { data: payments } = useGetPaymentsByPartyQuery(
    { businessId: currentBusinessId!, partyId: partyId! },
    { skip: !currentBusinessId || !partyId },
  );

  const [activeTab, setActiveTab] = useState('about');

  const TABS = [
    { id: 'about', label: 'About' },
    { id: 'sites-agreements', label: 'Sites & Agreements' },
    { id: 'bills', label: 'Bills' },
    { id: 'payments', label: 'Payments' },
    { id: 'statements', label: 'Statements' },
    { id: 'share-links', label: 'Share Links' },
  ];

  /** Tracks which site code is currently being inline-edited (null = none) */
  const [editingSiteCode, setEditingSiteCode] = useState<string | null>(null);
  const [editSiteAddress, setEditSiteAddress] = useState('');
  const [editSiteStateCode, setEditSiteStateCode] = useState('');
  const [editSiteError, setEditSiteError] = useState<string | null>(null);

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
    [createAgreement, currentBusinessId, partyId],
  );

  /** Enter inline edit mode for a site row */
  const startEditingSite = (site: Site) => {
    setEditingSiteCode(site.code);
    setEditSiteAddress(site.address);
    setEditSiteStateCode(site.stateCode ?? '');
    setEditSiteError(null);
  };

  /** Cancel inline site editing */
  const cancelEditingSite = () => {
    setEditingSiteCode(null);
    setEditSiteError(null);
  };

  /** Save the inline site edit */
  const handleSaveSite = useCallback(
    async (originalCode: string) => {
      setEditSiteError(null);
      if (!editSiteAddress.trim()) {
        setEditSiteError('Address is required');
        return;
      }
      try {
        await updateSite({
          businessId: currentBusinessId!,
          partyId: partyId!,
          siteCode: originalCode,
          data: {
            address: editSiteAddress.trim(),
            stateCode: editSiteStateCode?.trim() || undefined,
          },
        }).unwrap();
        setEditingSiteCode(null);
      } catch (err) {
        setEditSiteError(getErrorMessage(err));
      }
    },
    [currentBusinessId, partyId, editSiteAddress, editSiteStateCode, updateSite],
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
        agreementId: statementAgreementId || undefined,
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
  }, [currentBusinessId, partyId, statementType, statementFrom, statementTo, statementAgreementId, triggerStatementPdf]);

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
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'about' && (
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
            <DetailField
              label="State Code"
              value={party.contact.stateCode}
              editable={{
                rawValue: party.contact.stateCode ?? '',
                inputType: 'text',
                onSave: (v) => handleContactSave('stateCode', v),
                isSaving,
              }}
            />
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

          {activeTab === 'sites-agreements' && (
            <>
          {/* Sites */}
          <DetailSection
            title={`Sites (${party.sites?.length || 0})`}
            headerActions={
              <button className="btn btn-sm btn-primary" onClick={() => setIsSiteModalOpen(true)}>
                + Add Site
              </button>
            }
          >
            {party.sites && party.sites.length > 0 ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Site Code</th>
                      <th>Address</th>
                      <th>State Code</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {party.sites.map((site) =>
                      editingSiteCode === site.code ? (
                        <tr key={site.code}>
                          <td>{site.code}</td>
                          <td>
                            <input
                              type="text"
                              className={`form-input ${pageStyles.siteEditInput}`}
                              value={editSiteAddress}
                              onChange={(e) => setEditSiteAddress(e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={`form-input ${pageStyles.siteCodeInput}`}
                              value={editSiteStateCode}
                              onChange={(e) => setEditSiteStateCode(e.target.value)}
                              placeholder="e.g. 27"
                              maxLength={2}
                            />
                          </td>
                          <td>
                            <div className={`action-buttons ${pageStyles.inlineEditRow}`}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSaveSite(site.code)}
                                disabled={isUpdatingSite}
                              >
                                {isUpdatingSite ? '...' : 'Save'}
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={cancelEditingSite}
                                disabled={isUpdatingSite}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={site.code}>
                          <td>{site.code}</td>
                          <td>{site.address}</td>
                          <td>{site.stateCode || '-'}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => startEditingSite(site)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
                {editSiteError && (
                  <p className="text-error-inline">{editSiteError}</p>
                )}
              </>
            ) : (
              <p className="text-empty">No sites added yet.</p>
            )}
          </DetailSection>

          {/* Agreements */}
          <DetailSection
            title={`Agreements (${party.agreements?.length || 0})`}
            headerActions={
              <button className="btn btn-sm btn-primary" onClick={() => setIsAgreementModalOpen(true)}>
                + Agreement
              </button>
            }
          >
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
                          className="link-accent"
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
              <p className="text-empty">No agreements yet.</p>
            )}
          </DetailSection>
            </>
          )}

          {activeTab === 'bills' && (
          <>
          {/* Bills */}
          {(() => {
            const agreementIdToSiteCode = Object.fromEntries(
              (party.agreements || []).map((a) => [a.agreementId, a.siteCode]),
            );
            const filteredBills = (bills || []).filter(
              (bill) =>
                billSiteFilter === '' ||
                agreementIdToSiteCode[bill.agreementId] === billSiteFilter,
            );
            const sortedBills = [...filteredBills].sort((a, b) => {
              const dateA = a.billDate ?? a.billingPeriod?.start ?? a.createdAt ?? '';
              const dateB = b.billDate ?? b.billingPeriod?.start ?? b.createdAt ?? '';
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            return (
              <DetailSection title={`Bills (${sortedBills.length})`}>
                {party.sites && party.sites.length > 0 && (
                  <div className={pageStyles.siteFilterRow}>
                    <label>Site:</label>
                    <select
                      value={billSiteFilter}
                      onChange={(e) => setBillSiteFilter(e.target.value)}
                      className={`form-input ${pageStyles.siteFilterSelect}`}
                    >
                      <option value="">All</option>
                      {party.sites.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {sortedBills.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bill Date</th>
                        <th>Bill #</th>
                        <th>Agreement / Site</th>
                        <th>Period</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBills.map((bill) => (
                        <tr key={bill._id}>
                          <td>
                            {formatDate(
                              bill.billDate ?? bill.billingPeriod?.end ?? bill.createdAt,
                            )}
                          </td>
                          <td>
                            <Link
                              to={`/bills/${bill._id}`}
                              className="link-accent"
                            >
                              {bill.billNumber}
                            </Link>
                          </td>
                          <td>
                            {bill.agreementId}
                            {agreementIdToSiteCode[bill.agreementId] && (
                              <> / {agreementIdToSiteCode[bill.agreementId]}</>
                            )}
                          </td>
                          <td>
                            {bill.billingPeriod
                              ? `${new Date(bill.billingPeriod.start).toLocaleDateString()} - ${new Date(bill.billingPeriod.end).toLocaleDateString()}`
                              : '-'}
                          </td>
                          <td>₹{bill.totalAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-empty">
                    No bills found.
                  </p>
                )}
              </DetailSection>
            );
          })()}
          </>
          )}

          {activeTab === 'payments' && (
          <>
          {/* Payments */}
          {(() => {
            const sortedPayments = [...(payments || [])].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
            return (
              <DetailSection title={`Payments (${sortedPayments.length})`}>
                {sortedPayments.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Bill</th>
                        <th>Status</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayments.map((payment) => (
                        <tr key={payment._id}>
                          <td>
                            <Link
                              to={`/payments/${payment._id}`}
                              className="link-accent"
                            >
                              {formatDate(payment.date)}
                            </Link>
                          </td>
                          <td>₹{payment.amount.toLocaleString()}</td>
                          <td>{payment.method.replace('_', ' ')}</td>
                          <td>
                            {payment.billId ? (
                              <Link
                                to={`/bills/${payment.billId}`}
                                className="link-accent"
                              >
                                View Bill
                              </Link>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            <span className={`status status-${payment.status}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td>{payment.reference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-empty">
                    No payments found.
                  </p>
                )}
              </DetailSection>
            );
          })()}
          </>
          )}

          {/* Statements */}
          {activeTab === 'statements' && (
          <DetailSection title="Statements">
            <div className={pageStyles.statementForm}>
              <div className={pageStyles.statementRow}>
                <label className={pageStyles.statementLabel}>Type</label>
                <select
                  value={statementType}
                  onChange={(e) => setStatementType(e.target.value as typeof statementType)}
                  className={`form-input ${pageStyles.statementSelect}`}
                >
                  <option value="ledger">Ledger</option>
                  <option value="bills">Bills</option>
                  <option value="items">Items</option>
                  <option value="aging">Aging / Outstanding</option>
                </select>
              </div>
              <div className={pageStyles.statementRow}>
                <label className={pageStyles.statementLabel}>From</label>
                <input
                  type="date"
                  value={statementFrom}
                  onChange={(e) => setStatementFrom(e.target.value)}
                  className={`form-input ${pageStyles.statementDateInput}`}
                />
              </div>
              <div className={pageStyles.statementRow}>
                <label className={pageStyles.statementLabel}>To</label>
                <input
                  type="date"
                  value={statementTo}
                  onChange={(e) => setStatementTo(e.target.value)}
                  className={`form-input ${pageStyles.statementDateInput}`}
                />
              </div>
              {party.agreements && party.agreements.length > 0 && (
                <div className={pageStyles.statementRow}>
                  <label className={pageStyles.statementLabel}>Agreement</label>
                  <select
                    value={statementAgreementId}
                    onChange={(e) => setStatementAgreementId(e.target.value)}
                    className={`form-input ${pageStyles.statementSelect}`}
                  >
                    <option value="">All Agreements</option>
                    {party.agreements.map((a) => (
                      <option key={a.agreementId} value={a.agreementId}>
                        {a.agreementId} ({a.siteCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={pageStyles.statementRow}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownloadStatement}
                  disabled={isDownloadingStatement || !statementFrom || !statementTo}
                >
                  {isDownloadingStatement ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </DetailSection>
          )}

          {/* Share Links */}
          {activeTab === 'share-links' && (
          <DetailSection title="Share Links">
            <ShareLinkManager partyId={partyId!} sites={party.sites || []} />
          </DetailSection>
          )}

          {/* Add Site Modal */}
          {currentBusinessId && (
            <AddSiteModal
              isOpen={isSiteModalOpen}
              onClose={() => setIsSiteModalOpen(false)}
              businessId={currentBusinessId}
              party={party}
            />
          )}

          {/* Add Agreement Modal */}
          <Modal
            isOpen={isAgreementModalOpen}
            onClose={() => setIsAgreementModalOpen(false)}
            title={`Add Agreement for ${party.name}`}
            size="form"
          >
            <AgreementForm
              inventoryItems={inventory || []}
              sites={party.sites || []}
              existingAgreements={party.agreements || []}
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
