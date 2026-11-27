import { useGetPartyCreditScoreQuery } from '../../api/partyApi';
import {
  ErrorMessage,
  Meter,
  MeterLegend,
  Spinner,
  StatusChip,
  type MeterTone,
} from '../../components/ui';
import { DetailSection } from '../../components/DetailPageShell';
import { formatMoney } from '../../utils/format';
import type { CreditBand, CreditBucketKey, PartyCreditScore } from '../../types';
import type { Tone } from '../../components/ui/status';
import styles from './PartyCreditScoreSection.module.css';

const TITLE = 'Credit score';

const BAND: Record<CreditBand, { label: string; tone: Tone }> = {
  good: { label: 'Good', tone: 'success' },
  moderate: { label: 'Moderate', tone: 'info' },
  bad: { label: 'Bad', tone: 'warning' },
  worst: { label: 'Worst', tone: 'danger' },
};

const BUCKET: Record<CreditBucketKey, { label: string; tone: MeterTone }> = {
  current: { label: '0–30 days', tone: 'accent' },
  days31_60: { label: '31–60 days', tone: 'info' },
  days61_90: { label: '61–90 days', tone: 'warning' },
  days90Plus: { label: '90+ days', tone: 'danger' },
};

const HOW = 'Based on what is unpaid now (60%) and bills paid in the last 12 months (40%).';

function historyLine(s: PartyCreditScore): string {
  if (s.paidBills === 0) return 'No bills paid in the last 12 months.';
  const bills = `${s.paidBills} ${s.paidBills === 1 ? 'bill' : 'bills'} paid in the last 12 months`;
  if (!s.avgDaysLate) return `${bills}, on time on average.`;
  return `${bills}, ${s.avgDaysLate} ${s.avgDaysLate === 1 ? 'day' : 'days'} late on average.`;
}

/** How well this party pays: score, band and what it owes now by age. */
export function PartyCreditScoreSection({
  businessId,
  partyId,
}: {
  businessId: string;
  partyId: string;
}) {
  const { data, error, isLoading, refetch } = useGetPartyCreditScoreQuery(
    { businessId, partyId },
    { skip: !businessId || !partyId }
  );

  // No bill or party read: the section is simply not offered.
  if (error && 'status' in error && error.status === 403) return null;

  let body;
  if (isLoading) {
    body = <Spinner message="Loading credit score…" />;
  } else if (error || !data) {
    body = <ErrorMessage error={error} onRetry={refetch} />;
  } else if (data.score === null || data.band === null) {
    body = (
      <>
        <p className={styles.empty}>Not enough data yet</p>
        <p className={styles.note}>
          Nothing is unpaid and no bill was paid in the last 12 months. {HOW}
        </p>
      </>
    );
  } else {
    const band = BAND[data.band];
    body = (
      <>
        <div className={styles.headline}>
          <span className={styles.score} aria-label={`Credit score ${data.score} out of 100`}>
            <span className="mono">{data.score}</span>
            <span className={styles.outOf}>/100</span>
          </span>
          <StatusChip status={data.band} tone={band.tone}>
            {band.label}
          </StatusChip>
        </div>
        <p className={styles.note}>{HOW}</p>

        <div className={styles.block}>
          <p className={styles.label}>
            Unpaid now <span className="mono">{formatMoney(data.outstanding)}</span>
          </p>
          {data.outstanding > 0 ? (
            <>
              <Meter
                hideLegend
                segments={data.buckets.map(b => ({
                  value: b.amount,
                  tone: BUCKET[b.key].tone,
                  label: BUCKET[b.key].label,
                }))}
              />
              <MeterLegend
                items={data.buckets.map(b => ({
                  tone: BUCKET[b.key].tone,
                  label: `${BUCKET[b.key].label} past due · ${formatMoney(b.amount)} · ${b.pct}%`,
                }))}
              />
            </>
          ) : (
            <p className={styles.note}>Nothing unpaid.</p>
          )}
        </div>

        <p className={styles.note}>{historyLine(data)}</p>
      </>
    );
  }

  return (
    <DetailSection title={TITLE} padded={false}>
      <div className={styles.body}>{body}</div>
    </DetailSection>
  );
}
