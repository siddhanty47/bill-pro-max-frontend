import { Link } from 'react-router-dom';
import type { BillStatementData } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { Card, Notice, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell } from './StatementShell';

interface BillsPreviewProps {
  data: BillStatementData;
}

const AMOUNT_HEADERS = ['Rent', 'Transport', 'Damage', 'Subtotal', 'Tax', 'Discount', 'Total'];

export function BillsPreview({ data }: BillsPreviewProps) {
  const { totals } = data;
  const totalAmounts = [
    totals.rentCharges,
    totals.transportationCharges,
    totals.damageCharges,
    totals.subtotal,
    totals.taxAmount,
    totals.discountAmount,
    totals.totalAmount,
  ];
  return (
    <StatementShell
      title="Bill statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}${
        data.siteCode ? ` | Site: ${data.siteCode}` : ''
      }`}
    >
      {data.bills.length === 0 ? (
        <Notice tone="info">No bills found for this period.</Notice>
      ) : (
        <Card padded={false}>
          <Table aria-label="Bill statement">
            <THead>
              <Tr>
                <Th nowrap>Bill #</Th>
                <Th nowrap>Date</Th>
                <Th>Site</Th>
                <Th>Period</Th>
                {AMOUNT_HEADERS.map(h => (
                  <Th key={h} align="right">
                    {h}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {data.bills.map(bill => (
                <Tr key={bill.billId}>
                  <Td nowrap>
                    <Link to={`/bills/${bill.billId}`}>{bill.billNumber}</Link>
                  </Td>
                  <Td nowrap>{formatDate(bill.billDate)}</Td>
                  <Td nowrap>{bill.siteCode || '-'}</Td>
                  <Td nowrap>
                    {bill.periodStart && bill.periodEnd
                      ? `${formatDate(bill.periodStart)} - ${formatDate(bill.periodEnd)}`
                      : '-'}
                  </Td>
                  {[
                    bill.rentCharges,
                    bill.transportationCharges,
                    bill.damageCharges,
                    bill.subtotal,
                    bill.taxAmount,
                    bill.discountAmount,
                    bill.totalAmount,
                  ].map((amount, i) => (
                    <Td key={AMOUNT_HEADERS[i]} align="right" mono nowrap>
                      {formatMoney(amount)}
                    </Td>
                  ))}
                </Tr>
              ))}
              <Tr>
                <Td colSpan={4}>
                  <strong>Totals ({totals.billCount} bills)</strong>
                </Td>
                {totalAmounts.map((amount, i) => (
                  <Td key={AMOUNT_HEADERS[i]} align="right" mono nowrap>
                    {formatMoney(amount)}
                  </Td>
                ))}
              </Tr>
            </TBody>
          </Table>
        </Card>
      )}
    </StatementShell>
  );
}
