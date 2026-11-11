/**
 * ScanReviewPanel
 * Shows what the photo-scan extractor read and flagged, so the user can verify
 * before submitting: confidence, raw GSTIN/site read off the challan, items that
 * were not auto-matched, and any warnings (e.g. failed quantity checksums).
 */
import { useMemo } from 'react';
import type { ExtractedChallanData } from '../../types';
import styles from './ScanReviewPanel.module.css';

interface ScanReviewPanelProps {
  result: ExtractedChallanData;
  onDismiss: () => void;
}

export default function ScanReviewPanel({ result, onDismiss }: ScanReviewPanelProps) {
  const unmatchedItems = useMemo(
    () => result.items.filter((i) => !i.itemId).map((i) => i.itemName),
    [result.items]
  );
  const partyUnmatched = !result.partyId && !!result.partyName;

  const confidenceClass =
    result.confidence === 'high'
      ? styles.badgeHigh
      : result.confidence === 'medium'
        ? styles.badgeMedium
        : styles.badgeLow;

  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <div className={styles.header}>
        <span className={styles.title}>Scan review</span>
        <span className={`${styles.badge} ${confidenceClass}`}>
          {result.confidence} confidence
        </span>
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>

      {(result.partyGstin || result.siteAddress) && (
        <dl className={styles.readList}>
          {result.partyGstin && (
            <div className={styles.readRow}>
              <dt className={styles.readLabel}>GSTIN read</dt>
              <dd className={styles.readValue}>{result.partyGstin}</dd>
            </div>
          )}
          {result.siteAddress && (
            <div className={styles.readRow}>
              <dt className={styles.readLabel}>Site read</dt>
              <dd className={styles.readValue}>{result.siteAddress}</dd>
            </div>
          )}
        </dl>
      )}

      {partyUnmatched && (
        <p className={styles.flag}>
          Party <strong>{result.partyName}</strong> was not auto-matched — please select it manually.
        </p>
      )}

      {unmatchedItems.length > 0 && (
        <p className={styles.flag}>
          {unmatchedItems.length} item{unmatchedItems.length > 1 ? 's' : ''} not auto-matched —
          select manually: <span className={styles.flagItems}>{unmatchedItems.join(', ')}</span>
        </p>
      )}

      {result.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {result.warnings.map((w, i) => (
            <li key={i} className={styles.warning}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
