import type { ItemStatementData } from '../../types';
import { FULL_DATE, formatDate } from '../../utils/format';
import { Card, DocNumber, StatCard, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell, StatementSummary } from './StatementShell';
import { NegativeStockNotice } from '../stock/NegativeStockNotice';
import { stockTone } from '../../utils/stock';

interface ItemsPreviewProps {
  data: ItemStatementData;
}

export function ItemsPreview({ data }: ItemsPreviewProps) {
  return (
    <StatementShell
      title="Item statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from, FULL_DATE)} to ${formatDate(data.period.to, FULL_DATE)}`}
      emptyMessage={data.items.length === 0 ? 'No item activity found for this period.' : undefined}
    >
      <NegativeStockNotice
        quantities={data.items.flatMap(i => [i.openingQty, ...i.events.map(e => e.runningQty)])}
      />
      {data.items.map(item => (
        <Card key={item.itemId} title={item.itemName} padded={false}>
          <Table dense aria-label={item.itemName}>
            <THead>
              <Tr>
                <Th nowrap>Date</Th>
                <Th>Challan #</Th>
                <Th align="right">Delivery qty</Th>
                <Th align="right">Return qty</Th>
                <Th align="right">Running qty</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr variant="total">
                <Td colSpan={4}>Opening qty</Td>
                <Td align="right" mono tone={stockTone(item.openingQty)}>
                  {item.openingQty}
                </Td>
              </Tr>
              {item.events.map((event, idx) => (
                <Tr key={idx}>
                  <Td nowrap>{formatDate(event.date, FULL_DATE)}</Td>
                  <Td>
                    {event.type === 'opening' ? (
                      'Opening stock'
                    ) : (
                      <DocNumber
                        value={event.challanNumber}
                        to={`/challans/${event.challanId}`}
                        wrap
                      />
                    )}
                  </Td>
                  <Td align="right" mono>
                    {event.type === 'return' ? '-' : event.quantity}
                  </Td>
                  <Td align="right" mono>
                    {event.type === 'return' ? event.quantity : '-'}
                  </Td>
                  <Td align="right" mono tone={stockTone(event.runningQty)}>
                    {event.runningQty}
                  </Td>
                </Tr>
              ))}
              <Tr variant="total">
                <Td colSpan={4}>Closing qty</Td>
                <Td align="right" mono tone={stockTone(item.closingQty)}>
                  {item.closingQty}
                </Td>
              </Tr>
              <Tr variant="total">
                <Td colSpan={2}>Summary</Td>
                <Td align="right" mono>
                  {item.totalDelivered}
                </Td>
                <Td align="right" mono>
                  {item.totalReturned}
                </Td>
                <Td align="right" nowrap>
                  Damaged <span className="mono">{item.damages.damaged}</span> · Short{' '}
                  <span className="mono">{item.damages.short}</span>
                </Td>
              </Tr>
            </TBody>
          </Table>
        </Card>
      ))}

      <StatementSummary>
        <StatCard label="Opening stock" value={data.grandTotals.totalOpening} />
        <StatCard label="Total delivered" value={data.grandTotals.totalDelivered} />
        <StatCard label="Total returned" value={data.grandTotals.totalReturned} />
        <StatCard
          label="Held at end"
          value={data.grandTotals.netHeld}
          valueTone={stockTone(data.grandTotals.netHeld)}
        />
        <StatCard label="Total damaged" value={data.grandTotals.totalDamaged} />
        <StatCard label="Total short" value={data.grandTotals.totalShort} />
      </StatementSummary>
    </StatementShell>
  );
}
