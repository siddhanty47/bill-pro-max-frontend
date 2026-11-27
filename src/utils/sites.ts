/**
 * @file Party site helpers shared by forms and pages
 * The default site is the party's own address: a money bucket for opening balances and
 * payments that belong to no particular site. In data it is siteCode null.
 */

/** Query-string token for the default site (backend DEFAULT_SITE_PARAM) */
export const DEFAULT_SITE_PARAM = '@default';

/** Label shown wherever the default site appears */
export const DEFAULT_SITE_LABEL = 'Default site (party address)';

/**
 * Human label for an agreement's site: "CODE — full address", for agreement pickers.
 * Falls back to the bare site code when the party has no matching site.
 */
export const siteLabel = (
  siteCode: string,
  sites: ReadonlyArray<{ code: string; address?: string }> | undefined
): string => {
  const address = sites?.find(s => s.code === siteCode)?.address?.trim();
  return address ? `${siteCode} — ${address}` : siteCode;
};
