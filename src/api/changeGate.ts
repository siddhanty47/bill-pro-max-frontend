/**
 * Change gate helpers: challan / agreement mutations accept `reason`, `confirmNegative` in the
 * body and `?dryRun=true` (report what would be touched, write nothing).
 */
import type { baseApi } from './baseApi';
import type { ApiResponse, DryRunResult, GateArgs } from '../types';

/** Merge gate fields into a request body and build the `?dryRun=true` params. */
export function withGate(
  args: GateArgs,
  body: object = {}
): { body: Record<string, unknown>; params?: { dryRun: 'true' } } {
  const { reason, confirmNegative, dryRun } = args;
  const merged: Record<string, unknown> = { ...body };
  if (reason !== undefined) merged.reason = reason;
  if (confirmNegative !== undefined) merged.confirmNegative = confirmNegative;
  return dryRun ? { body: merged, params: { dryRun: 'true' } } : { body: merged };
}

/** Unwrap a gated response: the written value, or the dry-run report. */
export function unwrapGated<T>(response: ApiResponse<T | DryRunResult>): T | DryRunResult {
  return response.data;
}

export function isDryRunResult(value: unknown): value is DryRunResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { dryRun?: unknown }).dryRun === true &&
    'report' in value
  );
}

type ApiTag = typeof baseApi extends { endpoints: unknown }
  ? Parameters<typeof baseApi.util.invalidateTags>[0] extends ReadonlyArray<infer T> | undefined
    ? T
    : never
  : never;

/**
 * `invalidatesTags` for a gated mutation: a dry run wrote nothing, so it invalidates nothing
 * (otherwise every preview would refetch bills, agreements and the dashboard).
 */
export function gatedTags<Arg>(tags: (arg: Arg) => ApiTag[]) {
  return (result: unknown, _error: unknown, arg: Arg): ApiTag[] =>
    isDryRunResult(result) ? [] : tags(arg);
}
