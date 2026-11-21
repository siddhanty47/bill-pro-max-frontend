/**
 * @file Party site helpers shared by forms and pages
 * The default site is the party's own address: a money bucket for opening balances and
 * payments that belong to no particular site. In data it is siteCode null.
 */

/** Query-string token for the default site (backend DEFAULT_SITE_PARAM) */
export const DEFAULT_SITE_PARAM = '@default';

/** Label shown wherever the default site appears */
export const DEFAULT_SITE_LABEL = 'Default site (party address)';
