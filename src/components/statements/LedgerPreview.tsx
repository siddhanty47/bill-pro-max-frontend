import type { LedgerStatementData } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { DocNumber, Table, THead, TBody, Tr, Th, Td } from '../ui';
import { StatementShell } from './StatementShell';
import styles from './StatementPreview.module.css';

interface LedgerPreviewProps {
  data: LedgerStatementData;
}

export function LedgerPreview({ data }: LedgerPreviewProps) {
  return (
    <StatementShell
      title="Ledger statement"
      partyName={data.party.name}
      period={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}`}
      emptyMessage={
        data.entries.length === 0 ? 'No transactions found for this period.' : undefined
      }
      body={
        <Table dense aria-label="Ledger statement">
          <THead>
            <Tr>
              <Th nowrap>Date</Th>
              <Th className={styles.description}>Description</Th>
              <Th>Reference</Th>
              <Th align="right">Debit</Th>
              <Th align="right">Credit</Th>
              <Th align="right">Balance</Th>
            </Tr>
          </THead>
          <TBody>
            <Tr variant="total">
              <Td colSpan={5}>Opening balance</Td>
              <Td align="right" mono nowrap>
                {formatMoney(data.openingBalance)}
              </Td>
            </Tr>
            {data.entries.map((entry, idx) => (
              <Tr key={idx}>
                <Td nowrap>{formatDate(entry.date)}</Td>
                <Td className={styles.description}>{entry.description}</Td>
                <Td>
                  <DocNumber
                    value={entry.reference}
                    to={entry.billId ? `/bills/${entry.billId}` : undefined}
                    wrap
                  />
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
            <Tr variant="total">
              <Td colSpan={3}>Totals</Td>
              <Td align="right" mono nowrap>
                {formatMoney(data.totalDebits)}
              </Td>
              <Td align="right" mono nowrap>
                {formatMoney(data.totalCredits)}
              </Td>
              <Td align="right" mono />
            </Tr>
            <Tr variant="total">
              <Td colSpan={5}>Closing balance</Td>
              <Td align="right" mono nowrap>
                {formatMoney(data.closingBalance)}
              </Td>
            </Tr>
          </TBody>
        </Table>
      }
    />
  );
}
