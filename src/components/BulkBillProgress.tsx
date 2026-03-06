/**
 * Non-blocking progress banner for bulk bill generation.
 * Displays at the top of BillsPage while jobs are running.
 */
import { useState } from 'react';
import type { BatchProgress } from '../hooks/useBillGenerationProgress';
import styles from './BulkBillProgress.module.css';

interface BulkBillProgressProps {
  batches: BatchProgress[];
  onDismiss: (batchId: string) => void;
}

export function BulkBillProgress({ batches, onDismiss }: BulkBillProgressProps) {
  if (batches.length === 0) return null;

  return (
    <div className={styles.container}>
      {batches.map(batch => (
        <BatchBanner key={batch.batchId} batch={batch} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function BatchBanner({ batch, onDismiss }: { batch: BatchProgress; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const done = batch.completed + batch.failed;
  const pct = batch.total > 0 ? Math.round((done / batch.total) * 100) : 0;
  const hasFailures = batch.failed > 0;
  const failures = batch.results.filter(r => r.status === 'failed');

  return (
    <div className={`${styles.banner} ${!batch.isProcessing ? styles.done : ''} ${hasFailures ? styles.hasErrors : ''}`}>
      <div className={styles.header}>
        <div className={styles.info}>
          {batch.isProcessing ? (
            <span className={styles.spinner} />
          ) : (
            <span className={styles.checkmark}>&#10003;</span>
          )}
          <span>
            {batch.isProcessing
              ? `Generating bills: ${batch.completed}/${batch.total} completed`
              : `Bill generation complete: ${batch.completed} succeeded`}
            {batch.failed > 0 && (
              <span className={styles.failCount}>, {batch.failed} failed</span>
            )}
          </span>
        </div>
        <div className={styles.actions}>
          {hasFailures && (
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'Hide errors' : 'Show errors'}
            </button>
          )}
          {!batch.isProcessing && (
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={() => onDismiss(batch.batchId)}
              title="Dismiss"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {batch.isProcessing && (
        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {expanded && failures.length > 0 && (
        <div className={styles.errorList}>
          {failures.map((f, i) => (
            <div key={i} className={styles.errorItem}>
              <span className={styles.errorAgreement}>{f.agreementId}</span>
              <span className={styles.errorMsg}>{f.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
