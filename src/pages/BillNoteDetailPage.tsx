/**
 * @fileoverview Credit/debit note detail page
 * @description One note: reason, lines, tax summary, causes (auto notes), linked bill and party,
 * change history. Drafts can be edited (manual: lines + reason; auto: reason only), issued
 * (confirm; gets its number and freezes) or cancelled; issued notes can be emailed and
 * downloaded as PDF. Amounts on a credit note read negative.
 */
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useCancelBillNoteMutation,
  useGetBillNoteQuery,
  useIssueBillNoteMutation,
  useLazyDownloadBillNotePdfQuery,
  useSendBillNoteMutation,
  useUpdateBillNoteMutation,
} from '../api/billNoteApi';
import { useGetPartiesQuery } from '../api/partyApi';
import { getErrorMessage } from '../api/baseApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import {
  Button,
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  NotAdded,
  Notice,
  Table,
  TBody,
  Td,
  TextLink,
  Tr,
  type Column,
} from '../components/ui';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { BillNoteForm, type BillNoteFormValues } from '../components/forms/BillNoteForm';
import { getApiError, hasApiErrorCode } from '../utils/apiError';
import { noteSign } from '../utils/billMoney';
import { NOTE_LINE_KIND_LABEL, NOTE_SOURCE_LABEL, NOTE_TYPE_LABEL } from '../utils/billNoteLabels';
import { formatDate, formatMoney } from '../utils/format';
import type { BillChangeCause, BillNoteLine } from '../types';
import styles from './BillNoteDetailPage.module.css';

const CAUSE_KIND_LABEL: Record<BillChangeCause['kind'], string> = {
  challan: 'Challan',
  agreement: 'Agreement',
  system: 'System',
};

const OUT_OF_DATE = 'The amount changed since you opened this note. Review it again.';

type LineRow = BillNoteLine & { idx: number };
type CauseRow = BillChangeCause & { idx: number };
type Banner = { tone: 'success' | 'warning' | 'danger'; text: string };

/** The server's message for a failed note action (typed errors carry a readable message). */
const messageOf = (err: unknown) => getApiError(err).message ?? getErrorMessage(err);

function causeLink(c: BillChangeCause): ReactNode {
  if (c.kind === 'challan') return <TextLink to={`/challans/${c.id}`}>{c.label}</TextLink>;
  if (c.kind === 'agreement') return <TextLink to={`/agreements/${c.id}`}>{c.label}</TextLink>;
  return c.label;
}

/**
 * Route: /bill-notes/:noteId
 */
export function BillNoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const ids = { businessId: currentBusinessId!, noteId: noteId! };

  const {
    data: note,
    isLoading,
    error,
    refetch,
  } = useGetBillNoteQuery(ids, { skip: !currentBusinessId || !noteId });
  const { data: parties } = useGetPartiesQuery(currentBusinessId || '', {
    skip: !currentBusinessId,
  });

  const [updateNote, { isLoading: isSaving }] = useUpdateBillNoteMutation();
  const [issueNote, { isLoading: isIssuing }] = useIssueBillNoteMutation();
  const [cancelNote, { isLoading: isCancelling }] = useCancelBillNoteMutation();
  const [sendNote, { isLoading: isSending }] = useSendBillNoteMutation();
  const [downloadPdf, { isLoading: isDownloading }] = useLazyDownloadBillNotePdfQuery();

  const [activeTab, setActiveTab] = useState('about');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'issue' | 'cancel' | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const sign = note ? noteSign(note.type) : 1;
  const signed = (n: number) => formatMoney(sign * n);
  const partyName = parties?.find(p => p._id === note?.partyId)?.name ?? '';
  const typeLabel = note ? NOTE_TYPE_LABEL[note.type] : '';

  const handleIssue = async () => {
    setConfirming(null);
    setBanner(null);
    try {
      await issueNote(ids).unwrap();
    } catch (err) {
      if (hasApiErrorCode(err, 'NOTE_OUT_OF_DATE')) {
        setBanner({ tone: 'warning', text: OUT_OF_DATE });
        refetch();
      } else {
        setBanner({ tone: 'danger', text: messageOf(err) });
      }
    }
  };

  const handleCancel = async () => {
    setConfirming(null);
    setBanner(null);
    try {
      await cancelNote(ids).unwrap();
    } catch (err) {
      setBanner({ tone: 'danger', text: messageOf(err) });
    }
  };

  const handleSave = async (values: BillNoteFormValues) => {
    setEditError(null);
    try {
      await updateNote({ ...ids, data: values }).unwrap();
      setEditing(false);
    } catch (err) {
      setEditError(messageOf(err));
    }
  };

  const handleSend = async () => {
    setBanner(null);
    try {
      await sendNote(ids).unwrap();
      setBanner({ tone: 'success', text: 'Note sent' });
    } catch (err) {
      setBanner({ tone: 'danger', text: messageOf(err) });
    }
  };

  const handleDownload = async () => {
    if (!note) return;
    setBanner(null);
    try {
      await downloadPdf({
        ...ids,
        fileName: `note-${(note.noteNumber ?? 'draft').replace(/\//g, '-')}.pdf`,
      }).unwrap();
    } catch (err) {
      setBanner({ tone: 'danger', text: messageOf(err) });
    }
  };

  // ─── Tables ───────────────────────────────────────────────────────

  const lineColumns: Column<LineRow>[] = [
    { key: 'kind', header: 'Kind', nowrap: true, render: l => NOTE_LINE_KIND_LABEL[l.kind] },
    { key: 'description', header: 'Description' },
    {
      key: 'amount',
      header: 'Amount',
      mono: true,
      align: 'right',
      nowrap: true,
      render: l => signed(l.amount),
    },
  ];
  const lineRows: LineRow[] = (note?.lines ?? []).map((l, idx) => ({ ...l, idx }));

  const causeColumns: Column<CauseRow>[] = [
    { key: 'label', header: 'Change', render: causeLink },
    {
      key: 'kind',
      header: 'Type',
      nowrap: true,
      hideOnMobile: true,
      render: c => CAUSE_KIND_LABEL[c.kind],
    },
    { key: 'reason', header: 'Reason', render: c => c.reason || <NotAdded /> },
    { key: 'at', header: 'Date', nowrap: true, render: c => formatDate(c.at) },
  ];
  const causeRows: CauseRow[] = (note?.causes ?? []).map((c, idx) => ({ ...c, idx }));

  const summaryRow = (label: string, amount: number, strong = false, pct?: number) => (
    <Tr key={label} variant={strong ? 'total' : undefined}>
      <Td>{label}</Td>
      <Td align="right" nowrap>
        <span className="mono">{signed(amount)}</span>
        {pct !== undefined && <span> ({pct}%)</span>}
      </Td>
    </Tr>
  );

  // ─── Shell ────────────────────────────────────────────────────────

  const sidebar = note ? (
    <DetailSection title="Details">
      <DetailField
        label="Number"
        value={note.noteNumber ? <DocNumber wrap value={note.noteNumber} /> : 'Draft'}
      />
      <DetailField label="Type" value={typeLabel} />
      <DetailField label="Source" value={NOTE_SOURCE_LABEL[note.source]} />
      <DetailField label="Note date" value={formatDate(note.noteDate ?? '')} />
      <DetailField
        label="Bill"
        value={<DocNumber wrap value={note.billNumber} to={`/bills/${note.billId}`} />}
      />
      <DetailField
        label="Party"
        value={
          partyName ? <TextLink to={`/parties/${note.partyId}`}>{partyName}</TextLink> : undefined
        }
      />
      <DetailField
        label="Agreement"
        value={<DocNumber wrap value={note.agreementId} to={`/agreements/${note.agreementId}`} />}
      />
      <DetailField label="Site" value={note.siteCode} mono />
      <DetailField label="Created by" value={note.createdBy?.name} />
      <DetailField label="Created" value={formatDate(note.createdAt ?? '')} />
    </DetailSection>
  ) : null;

  /** An issue or cancel is in flight: the draft must not be edited or cancelled meanwhile */
  const busy = isIssuing || isCancelling;

  let headerActions: ReactNode;
  if (note?.status === 'draft') {
    headerActions = (
      <>
        <Button variant="primary" onClick={() => setConfirming('issue')} loading={isIssuing}>
          Issue
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setEditError(null);
            setEditing(true);
          }}
        >
          Edit
        </Button>
        <Menu trigger={p => <IconButton label="More actions" icon="more" disabled={busy} {...p} />}>
          <MenuItem tone="danger" onSelect={() => setConfirming('cancel')}>
            Cancel note
          </MenuItem>
        </Menu>
      </>
    );
  } else if (note?.status === 'issued') {
    headerActions = (
      <>
        <Button variant="primary" onClick={handleSend} loading={isSending}>
          Send email
        </Button>
        <Button onClick={handleDownload} loading={isDownloading}>
          Download PDF
        </Button>
      </>
    );
  }

  const intra = note?.taxMode === 'intra';

  return (
    <DetailPageShell
      recordNoun="note"
      title={note ? (note.noteNumber ?? `${typeLabel} note`) : 'Note'}
      status={note?.status}
      backTo="/bill-notes"
      backLabel="Notes"
      isLoading={isLoading}
      loadingLabel="Loading note…"
      error={error}
      onRetry={refetch}
      tabs={
        note
          ? [
              { id: 'about', label: 'About' },
              { id: 'change-history', label: 'Change history' },
            ]
          : undefined
      }
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="note"
      sidebar={sidebar}
      headerActions={headerActions}
    >
      {note && (
        <>
          {banner && <Notice tone={banner.tone}>{banner.text}</Notice>}

          {activeTab === 'about' && (
            <>
              <DetailSection title="Reason">
                <DetailField label="" value={note.reason || undefined} />
              </DetailSection>

              <Card title="Lines" count={lineRows.length} padded={false}>
                <DataTable
                  aria-label="Lines"
                  columns={lineColumns}
                  rows={lineRows}
                  rowKey={l => `${l.kind}-${l.itemId ?? ''}-${l.idx}`}
                  empty={<EmptyState title="No lines" />}
                  mobile={{
                    title: l => l.description,
                    badge: l => <span className="mono">{signed(l.amount)}</span>,
                    meta: l => [NOTE_LINE_KIND_LABEL[l.kind]],
                  }}
                />
              </Card>

              <Card title="Summary" padded={false}>
                <Table aria-label="Summary" detail>
                  <TBody>
                    {summaryRow('Subtotal', note.subtotal)}
                    {note.discountAmount !== 0 && summaryRow('Discount', note.discountAmount)}
                    {intra ? (
                      <>
                        {summaryRow('SGST', note.sgstAmount, false, note.sgstRate)}
                        {summaryRow('CGST', note.cgstAmount, false, note.cgstRate)}
                      </>
                    ) : (
                      summaryRow('IGST', note.igstAmount, false, note.igstRate)
                    )}
                    {summaryRow('Total', note.totalAmount, true)}
                  </TBody>
                </Table>
              </Card>

              {causeRows.length > 0 && (
                <Card title="Causes" count={causeRows.length} padded={false}>
                  <DataTable
                    aria-label="Causes"
                    columns={causeColumns}
                    rows={causeRows}
                    rowKey={c => `${c.kind}-${c.id}-${c.idx}`}
                    mobile={{
                      title: causeLink,
                      subtitle: c => c.reason,
                      meta: c => [CAUSE_KIND_LABEL[c.kind], formatDate(c.at)],
                    }}
                  />
                </Card>
              )}
            </>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="BillNote" documentId={noteId!} />
          )}

          <Modal isOpen={editing} onClose={() => setEditing(false)} title="Edit note" size="form">
            <BillNoteForm
              mode="edit"
              source={note.source}
              type={note.type}
              initial={{ reason: note.reason, lines: note.lines }}
              bill={note}
              onSubmit={handleSave}
              onCancel={() => setEditing(false)}
              isLoading={isSaving}
              error={editError}
            />
          </Modal>

          <Modal
            isOpen={confirming === 'issue'}
            onClose={() => setConfirming(null)}
            title="Issue note"
          >
            <p className={styles.text}>
              Issue this note? It gets the next number and can&apos;t be changed after.
            </p>
            <div className={styles.actions}>
              <Button onClick={() => setConfirming(null)}>Back</Button>
              <Button variant="primary" onClick={handleIssue}>
                Issue note
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={confirming === 'cancel'}
            onClose={() => setConfirming(null)}
            title="Cancel note"
          >
            <p className={styles.text}>Cancel this note? A cancelled note can&apos;t be issued.</p>
            <div className={styles.actions}>
              <Button onClick={() => setConfirming(null)}>Keep note</Button>
              <Button variant="danger" onClick={handleCancel} loading={isCancelling}>
                Cancel note
              </Button>
            </div>
          </Modal>
        </>
      )}
    </DetailPageShell>
  );
}
