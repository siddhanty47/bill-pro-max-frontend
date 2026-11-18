/**
 * `setValueAs` for optional number inputs: empty -> undefined (`valueAsNumber`
 * would give NaN, which an optional `z.number()` rejects with no visible message).
 * Filled values parse exactly as `valueAsNumber` would.
 */
export const optionalNumber = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
