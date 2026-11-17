import { Link } from 'react-router-dom';
import type { LedgerStatementData } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { Card, Notice, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell } from './StatementShell';

interface LedgerPreviewProps {
  data: LedgerStatementData;
}

export function LedgerPreview({ data }: LedgerPreviewProps) {
  return (
    <StatementShell
      title="Ledger statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}`}
    >
      {data.entries.length === 0 ? (
        <Notice tone="info">No transactions found for this period.</Notice>
      ) : (
        <Card padded={false}>
          <Table aria-label="Ledger statement">
            <THead>
              <Tr>
                <Th nowrap>Date</Th>
                <Th>Description</Th>
                <Th>Reference</Th>
                <Th align="right">Debit</Th>
                <Th align="right">Credit</Th>
                <Th align="right">Balance</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td colSpan={5}>
                  <strong>Opening balance</strong>
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(data.openingBalance)}
                </Td>
              </Tr>
              {data.entries.map((entry, idx) => (
                <Tr key={idx}>
                  <Td nowrap>{formatDate(entry.date)}</Td>
                  <Td>{entry.description}</Td>
                  <Td nowrap>
                    {entry.billId ? (
                      <Link to={`/bills/${entry.billId}`}>{entry.reference}</Link>
                    ) : (
                      entry.reference
                    )}
                  </Td>
                  <Td align="right" mono nowrap>
                    {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                  </Td>
                  <Td align="right" mono nowrap>
                    {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                  </Td>
                  <Td align="right" mono nowrap>
                    {formatMoney(entry.balance)}
                  </Td>
                </Tr>
              ))}
              <Tr>
                <Td colSpan={3}>
                  <strong>Totals</strong>
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(data.totalDebits)}
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(data.totalCredits)}
                </Td>
                <Td align="right" mono />
              </Tr>
              <Tr>
                <Td colSpan={5}>
                  <strong>Closing balance</strong>
                </Td>
                <Td align="right" mono nowrap>
                  {formatMoney(data.closingBalance)}
                </Td>
              </Tr>
            </TBody>
          </Table>
        </Card>
      )}
    </StatementShell>
  );
}
