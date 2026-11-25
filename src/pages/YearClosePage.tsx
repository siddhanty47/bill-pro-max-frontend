/**
 * Year close: every site with an agreement active in the chosen financial year, whether the year
 * is closed for it (its bill ending on the last billable day is issued) and the closing bill.
 * Derived on the server (`GET /year-close?fy=`); nothing here changes data. Route: /year-close
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetYearStatusQuery } from '../api/yearCloseApi';
import {
  Card,
  DataTable,
  DocNumber,
  EmptyState,
  ErrorMessage,
  FilterBar,
  NotAdded,
  PageHeader,
  Select,
  Spinner,
  StatusChip,
  TextLink,
  type Column,
} from '../components/ui';
import { formatDate, FULL_DATE } from '../utils/format';
import { fyHasEnded, recentFys } from '../utils/financialYear';
import type { YearStatusRow } from '../types';
import styles from './YearClosePage.module.css';

type YearState = 'closed' | 'open' | 'running';

const STATE_CHIP: Record<YearState, { label: string; tone: 'success' | 'warning' | 'info' }> = {
  closed: { label: 'Closed', tone: 'success' },
  open: { label: 'Open', tone: 'warning' },
  running: { label: 'Running', tone: 'info' },
};

const rowKey = (r: YearStatusRow) => `${r.partyId}:${r.siteCode}`;
const lastDay = (r: YearStatusRow) => formatDate(r.lastBillableDay, FULL_DATE);

export function YearClosePage() {
  const { currentBusinessId } = useCurrentBusiness();
  const today = new Date();
  const fys = recentFys(today);
  // The last FY that has ended is the one to close
  const [fy, setFy] = useState(fys[1]);
  const ended = fyHasEnded(fy, today);

  // currentData: the chosen FY's rows only, never the previous FY's while the new one loads
  const {
    currentData: rows,
    isFetching,
    error,
    refetch,
  } = useGetYearStatusQuery(
    { businessId: currentBusinessId || '', fy },
    { skip: !currentBusinessId }
  );

  const stateOf = (r: YearStatusRow): YearState =>
    r.closed ? 'closed' : ended ? 'open' : 'running';
  const chip = (r: YearStatusRow) => {
    const { label, tone } = STATE_CHIP[stateOf(r)];
    return (
      <StatusChip status={stateOf(r)} tone={tone}>
        {label}
      </StatusChip>
    );
  };
  /** What closes an open year: the bill ending on the last billable day */
  const helper = (r: YearStatusRow) =>
    stateOf(r) === 'open' && r.lastBillableDay
      ? `Issue the bill ending ${lastDay(r)} to close the year`
      : null;
  const closingBill = (r: YearStatusRow) =>
    r.closingBillId && r.closingBillNumber ? (
      <DocNumber value={r.closingBillNumber} to={`/bills/${r.closingBillId}`} />
    ) : (
      helper(r) && <span className={styles.helper}>{helper(r)}</span>
    );
  const party = (r: YearStatusRow) => (
    <TextLink to={`/parties/${r.partyId}`}>{r.partyName}</TextLink>
  );

  const columns: Column<YearStatusRow>[] = [
    { key: 'partyName', header: 'Party', render: party },
    {
      key: 'siteCode',
      header: 'Site',
      render: r => (
        <span className={styles.site}>
          <span className="mono">{r.siteCode}</span>
          <span>{r.siteAddress}</span>
        </span>
      ),
    },
    {
      key: 'lastBillableDay',
      header: 'Last billable day',
      nowrap: true,
      render: r => lastDay(r) || <NotAdded />,
    },
    { key: 'closed', header: 'Status', nowrap: true, render: chip },
    { key: 'closingBillId', header: 'Closing bill', render: closingBill },
  ];

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  return (
    <div>
      <PageHeader
        title="Year close"
        subtitle="A year closes for a site once its bill ending on the last billable day is issued. After that nothing dated in that year can change."
      />

      <FilterBar>
        <Select aria-label="Financial year" value={fy} onChange={e => setFy(e.target.value)}>
          {fys.map(f => (
            <option key={f} value={f}>
              FY {f}
            </option>
          ))}
        </Select>
      </FilterBar>

      {isFetching && !rows ? (
        <Spinner message="Loading year status…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={refetch} />
      ) : (
        <Card padded={false}>
          <DataTable
            aria-label="Year status"
            columns={columns}
            rows={rows ?? []}
            rowKey={rowKey}
            empty={<EmptyState title={`No sites were billable in FY ${fy}`} />}
            mobile={{
              title: party,
              badge: chip,
              subtitle: r => (
                <>
                  <span className="mono">{r.siteCode}</span> {r.siteAddress}
                </>
              ),
              meta: r => [
                r.lastBillableDay ? `Last billable day ${lastDay(r)}` : '',
                r.closingBillNumber && (
                  <span key="bill" className="mono">
                    {r.closingBillNumber}
                  </span>
                ),
                helper(r),
              ],
            }}
          />
        </Card>
      )}
    </div>
  );
}
