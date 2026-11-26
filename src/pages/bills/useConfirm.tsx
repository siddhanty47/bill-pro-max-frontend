import { useState } from 'react';
import { BillConfirmDialog, type ConfirmRequest } from './BillConfirmDialog';

/** Holds one pending confirm request; render `dialog` once on the page. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const dialog = <BillConfirmDialog request={request} onClose={() => setRequest(null)} />;
  return { ask: setRequest, dialog };
}
