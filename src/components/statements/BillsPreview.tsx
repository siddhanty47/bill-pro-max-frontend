import type { BillStatementData } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { DocNumber, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell } from './StatementShell';

interface BillsPreviewProps {
  data: BillStatementData;
}

const AMOUNT_HEADERS = ['Rent', 'Transport', 'Damage', 'Subtotal', 'Tax', 'Discount', 'Total'];

function amountsOf(r: {
  rentCharges: number;
  transportationCharges: number;
  damageCharges: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}): number[] {
  return [
    r.rentCharges,
    r.transportationCharges,
    r.damageCharges,
    r.subtotal,
    r.taxAmount,
    r.discountAmount,
    r.totalAmount,
  ];
}

/*
 * Documented exception: with 7 amount columns plus bill, date, site and period, this
 * table can be wider than its column next to the sidebar (about 638px at 1280). It
 * scrolls horizontally inside its own Card (the kit Table wrapper) rather than drop
 * columns or break bill numbers; Period may wrap between its two dates.
 */
export function BillsPreview({ data }: BillsPreviewProps) {
  const { totals } = data;
  return (
    <StatementShell
      title="Bill statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}${
        data.siteCode ? ` · Site: ${data.siteCode}` : ''
      }`}
      emptyMessage={data.bills.length === 0 ? 'No bills found for this period.' : undefined}
      body={
        <Table dense aria-label="Bill statement">
          <THead>
            <Tr>
              <Th>Bill #</Th>
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
                <Td>
                  <DocNumber value={bill.billNumber} to={`/bills/${bill.billId}`} />
                </Td>
                <Td nowrap>{formatDate(bill.billDate)}</Td>
                <Td>{bill.siteCode || '-'}</Td>
                <Td>
                  {bill.periodStart && bill.periodEnd
                    ? `${formatDate(bill.periodStart)} - ${formatDate(bill.periodEnd)}`
                    : '-'}
                </Td>
                {amountsOf(bill).map((amount, i) => (
                  <Td key={AMOUNT_HEADERS[i]} align="right" mono nowrap>
                    {formatMoney(amount)}
                  </Td>
                ))}
              </Tr>
            ))}
            <Tr variant="total">
              <Td colSpan={4}>Totals ({totals.billCount} bills)</Td>
              {amountsOf(totals).map((amount, i) => (
                <Td key={AMOUNT_HEADERS[i]} align="right" mono nowrap>
                  {formatMoney(amount)}
                </Td>
              ))}
            </Tr>
          </TBody>
        </Table>
      }
    />
  );
}
