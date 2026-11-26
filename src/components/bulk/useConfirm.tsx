import { useState } from 'react';
import { BulkConfirmDialog, type ConfirmRequest } from './BulkConfirmDialog';

/** Holds one pending confirm request; render `dialog` once on the page. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const dialog = <BulkConfirmDialog request={request} onClose={() => setRequest(null)} />;
  return { ask: setRequest, dialog };
}
