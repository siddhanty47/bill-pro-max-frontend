import { Link } from 'react-router-dom';
import type { AgingStatementData } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { Card, Notice, StatCard, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell, StatementSummary } from './StatementShell';

interface AgingPreviewProps {
  data: AgingStatementData;
}

export function AgingPreview({ data }: AgingPreviewProps) {
  return (
    <StatementShell
      title="Aging statement"
      partyName={data.party.name}
      period={`As of ${formatDate(data.asOfDate)}`}
    >
      {data.bills.length === 0 ? (
        <Notice tone="info">No outstanding bills found.</Notice>
      ) : (
        <>
          <Card padded={false}>
            <Table aria-label="Aging statement">
              <THead>
                <Tr>
                  <Th nowrap>Bill #</Th>
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
                    <Td nowrap>
                      <Link to={`/bills/${bill.billId}`}>{bill.billNumber}</Link>
                    </Td>
                    <Td nowrap>{formatDate(bill.billDate)}</Td>
                    <Td nowrap>{formatDate(bill.dueDate)}</Td>
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
                    <Td nowrap>{bill.bucket}</Td>
                  </Tr>
                ))}
                <Tr>
                  <Td colSpan={6}>
                    <strong>Grand total</strong>
                  </Td>
                  <Td align="right" mono nowrap>
                    {formatMoney(data.grandTotal)}
                  </Td>
                  <Td />
                </Tr>
              </TBody>
            </Table>
          </Card>

          <StatementSummary>
            <StatCard label="Current (0-30)" value={formatMoney(data.buckets.current)} />
            <StatCard label="31-60 days" value={formatMoney(data.buckets.days31_60)} />
            <StatCard label="61-90 days" value={formatMoney(data.buckets.days61_90)} />
            <StatCard label="90+ days" value={formatMoney(data.buckets.days90Plus)} />
          </StatementSummary>
        </>
      )}
    </StatementShell>
  );
}
