import type { AgingStatementData } from '../../types';
import { FULL_DATE, formatDate, formatMoney } from '../../utils/format';
import { DocNumber, StatCard, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell, StatementSummary } from './StatementShell';

interface AgingPreviewProps {
  data: AgingStatementData;
}

export function AgingPreview({ data }: AgingPreviewProps) {
  return (
    <StatementShell
      title="Aging statement"
      partyName={data.party.name}
      period={`As of ${formatDate(data.asOfDate, FULL_DATE)}`}
      emptyMessage={data.bills.length === 0 ? 'No outstanding bills found.' : undefined}
      body={
        <Table dense aria-label="Aging statement">
          <THead>
            <Tr>
              <Th>Bill #</Th>
              <Th nowrap>Bill date</Th>
              <Th nowrap>Due date</Th>
              <Th align="right">Days overdue</Th>
              <Th align="right">Total</Th>
              <Th align="right">Paid</Th>
              <Th align="right">Balance due</Th>
              <Th>Bucket</Th>
            </Tr>
          </THead>
          <TBody>
            {data.bills.map(bill => (
              <Tr key={bill.billId}>
                <Td>
                  <DocNumber value={bill.billNumber} to={`/bills/${bill.billId}`} wrap />
                </Td>
                <Td nowrap>{formatDate(bill.billDate, FULL_DATE)}</Td>
                <Td nowrap>{formatDate(bill.dueDate, FULL_DATE)}</Td>
                <Td align="right" mono nowrap>
                  {bill.daysOverdue}
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(bill.totalAmount)}
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(bill.amountPaid)}
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(bill.balanceDue)}
                </Td>
                <Td>{bill.bucket}</Td>
              </Tr>
            ))}
            <Tr variant="total">
              <Td colSpan={6}>Grand total</Td>
              <Td align="right" mono nowrap>
                {formatMoney(data.grandTotal)}
              </Td>
              <Td />
            </Tr>
          </TBody>
        </Table>
      }
    >
      <StatementSummary>
        <StatCard label="Current (0-30)" value={formatMoney(data.buckets.current)} />
        <StatCard label="31-60 days" value={formatMoney(data.buckets.days31_60)} />
        <StatCard label="61-90 days" value={formatMoney(data.buckets.days61_90)} />
        <StatCard label="90+ days" value={formatMoney(data.buckets.days90Plus)} />
      </StatementSummary>
    </StatementShell>
  );
}
