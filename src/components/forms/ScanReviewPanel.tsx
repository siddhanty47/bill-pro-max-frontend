/**
 * ScanReviewPanel
 * Shows what the photo-scan extractor read and flagged, so the user can verify
 * before submitting: confidence, raw GSTIN/site read off the challan, what each
 * handwritten item was matched to, the party and items that were not auto-matched, and any warnings (e.g. failed quantity
 * checksums).
 */
import { useMemo } from 'react';
import type { ExtractedChallanData } from '../../types';
import { IconButton, Notice, StatusChip, Table, TBody, Td, Th, Tr } from '../ui';
import type { Tone } from '../ui/status';
import styles from './ScanReviewPanel.module.css';

interface ScanReviewPanelProps {
  result: ExtractedChallanData;
  onDismiss: () => void;
}

const CONFIDENCE_TONE: Record<ExtractedChallanData['confidence'], Tone> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

const CONFIDENCE_LABEL: Record<ExtractedChallanData['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export default function ScanReviewPanel({ result, onDismiss }: ScanReviewPanelProps) {
  const unmatchedItems = useMemo(
    () => result.items.filter(i => !i.itemId).map(i => i.itemName),
    [result.items]
  );
  const partyUnmatched = !result.partyId && !!result.partyName;
  const needsAttention =
    partyUnmatched ||
    unmatchedItems.length > 0 ||
    result.warnings.length > 0 ||
    result.confidence !== 'high';

  const rows: { label: string; value: string; mono?: boolean }[] = [];
  if (result.partyGstin) rows.push({ label: 'GSTIN read', value: result.partyGstin, mono: true });
  if (result.siteAddress) rows.push({ label: 'Site read', value: result.siteAddress });
  if (partyUnmatched)
    rows.push({ label: 'Party not matched', value: `${result.partyName}. Select it below.` });
  const readAs = [...result.items, ...result.damagedItems]
    .filter(i => i.itemId && i.readAs)
    .map(i => `${i.readAs} → ${i.itemName}`);
  if (readAs.length > 0) rows.push({ label: 'Matched', value: readAs.join('; ') });
  if (unmatchedItems.length > 0)
    rows.push({
      label: unmatchedItems.length > 1 ? 'Items not matched' : 'Item not matched',
      value: `${unmatchedItems.join(', ')}. Select ${unmatchedItems.length > 1 ? 'them' : 'it'} below.`,
    });

  return (
    <Notice
      tone={needsAttention ? 'warning' : 'success'}
      className={styles.panel}
      title={
        <span className={styles.header}>
          Scan review
          <StatusChip status={result.confidence} tone={CONFIDENCE_TONE[result.confidence]}>
            {CONFIDENCE_LABEL[result.confidence]}
          </StatusChip>
          <IconButton
            label="Dismiss scan review"
            icon="close"
            onClick={onDismiss}
            className={styles.dismiss}
          />
        </span>
      }
    >
      {rows.length > 0 && (
        <Table aria-label="Read from photo">
          <TBody>
            {rows.map(row => (
              <Tr key={row.label}>
                <Th scope="row" nowrap>
                  {row.label}
                </Th>
                <Td mono={row.mono}>{row.value}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {result.warnings.length > 0 && (
        <ul className={styles.warnings} aria-label="Warnings">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
