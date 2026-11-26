/** @fileoverview Party labels shared by the parties table and its CSV export. */
import { toCsv } from '../../utils/csv';
import type { Party } from '../../types';

export const roleLabel = (party: Party) =>
  party.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
export const siteCount = (party: Party) => party.sites?.length || 0;
export const activeAgreements = (party: Party) =>
  party.agreements?.filter(a => a.status === 'active').length || 0;

/** The CSV of `parties`: the columns the table shows, outstanding as a plain number. */
export function partiesCsv(parties: Party[], outstanding: (party: Party) => number): string {
  return toCsv(
    [
      'Code',
      'Name',
      'Roles',
      'Contact person',
      'Phone',
      'Sites',
      'Active agreements',
      'Outstanding',
      'Status',
    ],
    parties.map(p => [
      p.code,
      p.name,
      roleLabel(p),
      p.contact.person,
      p.contact.phone,
      siteCount(p),
      activeAgreements(p),
      outstanding(p),
      p.isActive ? 'Active' : 'Inactive',
    ])
  );
}
