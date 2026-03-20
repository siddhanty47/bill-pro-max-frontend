import type { StatementData } from '../../types';
import { LedgerPreview } from './LedgerPreview';
import { BillsPreview } from './BillsPreview';
import { ItemsPreview } from './ItemsPreview';
import { AgingPreview } from './AgingPreview';

interface StatementPreviewProps {
  data: StatementData;
}

export function StatementPreview({ data }: StatementPreviewProps) {
  switch (data.type) {
    case 'ledger':
      return <LedgerPreview data={data} />;
    case 'bills':
      return <BillsPreview data={data} />;
    case 'items':
      return <ItemsPreview data={data} />;
    case 'aging':
      return <AgingPreview data={data} />;
    default:
      return null;
  }
}
