import { Link } from 'react-router-dom';
import type { ItemStatementData } from '../../types';
import { formatDate } from '../../utils/format';
import { Card, Notice, StatCard, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell, StatementSummary } from './StatementShell';

interface ItemsPreviewProps {
  data: ItemStatementData;
}

export function ItemsPreview({ data }: ItemsPreviewProps) {
  return (
    <StatementShell
      title="Item statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}`}
    >
      {data.items.length === 0 ? (
        <Notice tone="info">No item activity found for this period.</Notice>
      ) : (
        <>
          {data.items.map(item => (
            <Card key={item.itemId} title={item.itemName} padded={false}>
              <Table aria-label={item.itemName}>
                <THead>
                  <Tr>
                    <Th nowrap>Date</Th>
                    <Th nowrap>Challan #</Th>
                    <Th align="right">Delivery qty</Th>
                    <Th align="right">Return qty</Th>
                    <Th align="right">Running qty</Th>
                  </Tr>
                </THead>
                <TBody>
                  <Tr>
                    <Td colSpan={4}>
                      <strong>Opening qty</strong>
                    </Td>
                    <Td align="right" mono>
                      {item.openingQty}
                    </Td>
                  </Tr>
                  {item.events.map((event, idx) => (
                    <Tr key={idx}>
                      <Td nowrap>{formatDate(event.date)}</Td>
                      <Td nowrap>
                        <Link to={`/challans/${event.challanId}`}>{event.challanNumber}</Link>
                      </Td>
                      <Td align="right" mono>
                        {event.type === 'delivery' ? event.quantity : '-'}
                      </Td>
                      <Td align="right" mono>
                        {event.type === 'return' ? event.quantity : '-'}
                      </Td>
                      <Td align="right" mono>
                        {event.runningQty}
                      </Td>
                    </Tr>
                  ))}
                  <Tr>
                    <Td colSpan={4}>
                      <strong>Closing qty</strong>
                    </Td>
                    <Td align="right" mono>
                      {item.closingQty}
                    </Td>
                  </Tr>
                  <Tr>
                    <Td colSpan={2}>
                      <strong>Summary</strong>
                    </Td>
                    <Td align="right" mono>
                      {item.totalDelivered}
                    </Td>
                    <Td align="right" mono>
                      {item.totalReturned}
                    </Td>
                    <Td align="right" mono nowrap>
                      Dmg: {item.damages.damaged} | Short: {item.damages.short}
                    </Td>
                  </Tr>
                </TBody>
              </Table>
            </Card>
          ))}

          <StatementSummary>
            <StatCard label="Total delivered" value={data.grandTotals.totalDelivered} />
            <StatCard label="Total returned" value={data.grandTotals.totalReturned} />
            <StatCard label="Net held" value={data.grandTotals.netHeld} />
            <StatCard label="Total damaged" value={data.grandTotals.totalDamaged} />
            <StatCard label="Total short" value={data.grandTotals.totalShort} />
          </StatementSummary>
        </>
      )}
    </StatementShell>
  );
}
