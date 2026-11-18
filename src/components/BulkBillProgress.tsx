/**
 * Non-blocking progress banner for bulk bill generation.
 * Displays at the top of BillsPage while jobs are running.
 */
import { useState } from 'react';
import type { BatchProgress } from '../hooks/useBillGenerationProgress';
import { Button, IconButton, Notice, ProgressBar } from './ui';
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

function BatchBanner({
  batch,
  onDismiss,
}: {
  batch: BatchProgress;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = batch.completed + batch.failed;
  const hasFailures = batch.failed > 0;
  const failures = batch.results.filter(r => r.status === 'failed');
  const tone = batch.isProcessing ? 'info' : hasFailures ? 'warning' : 'success';

  return (
    <Notice tone={tone}>
      <div className={styles.header}>
        <span className={styles.message}>
          {batch.isProcessing
            ? `Generating bills: ${batch.completed}/${batch.total} completed`
            : `Bill generation complete: ${batch.completed} succeeded`}
          {hasFailures && `, ${batch.failed} failed`}
        </span>
        <div className={styles.actions}>
          {hasFailures && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Hide errors' : 'Show errors'}
            </Button>
          )}
          {!batch.isProcessing && (
            <IconButton icon="close" label="Dismiss" onClick={() => onDismiss(batch.batchId)} />
          )}
        </div>
      </div>

      {batch.isProcessing && (
        <ProgressBar value={done} max={batch.total} label="Bill generation progress" />
      )}

      {expanded && failures.length > 0 && (
        <ul className={styles.errorList}>
          {failures.map((f, i) => (
            <li key={i} className={styles.errorItem}>
              <span className="mono">{f.agreementId}</span>
              <span>{f.error}</span>
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
