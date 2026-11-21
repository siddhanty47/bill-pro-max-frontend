import { createContext, useContext } from 'react';
import type { RecordNavLocationState } from '../../utils/recordNav';

/** The detail path of the table row being rendered, with the nav state its links should carry. */
export type RowLinkValue = { to: string; state: RecordNavLocationState };

export const RowLinkContext = createContext<RowLinkValue | null>(null);

/** The record-nav state for a link inside a `DataTable` row, only when it points at that row's record. */
export function useRowLinkState(to: string | undefined): RecordNavLocationState | undefined {
  const ctx = useContext(RowLinkContext);
  return ctx && to !== undefined && to === ctx.to ? ctx.state : undefined;
}
