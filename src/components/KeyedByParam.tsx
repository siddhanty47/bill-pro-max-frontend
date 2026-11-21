/**
 * @fileoverview Remounts its children whenever a route param changes
 * @description Detail pages keep per-record local state (edit drafts, filters). Prev/Next
 * only changes the `:id` param, so without a key that state would leak to the next record.
 */
import { Fragment, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

export function KeyedByParam({ param, children }: { param: string; children: ReactNode }) {
  const value = useParams()[param];
  return <Fragment key={value}>{children}</Fragment>;
}
