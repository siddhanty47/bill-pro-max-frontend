/**
 * @fileoverview A site's closed-year lock: nothing dated on or before `lockedThrough`
 * (31 March of its latest closed FY) can change. While the lookup loads, or when it fails,
 * the site reads as unlocked; the server still refuses the change.
 */
import { useMemo } from 'react';
import { useGetSiteClosedThroughQuery } from '../api/yearCloseApi';
import { closedYearMessage, isOnOrBeforeDay } from '../utils/financialYear';

export interface SiteLock {
  /** The closed FY label, or undefined when nothing is closed (or still loading) */
  fy?: string;
  /** ISO date: 31 March of the closed FY */
  lockedThrough?: string;
  /** The closed-year line, or '' when nothing is closed */
  message: string;
  /** True when `day` (an IST calendar day) is on or before `lockedThrough` */
  isLocked: (day: string | Date | null | undefined) => boolean;
}

export function useSiteLock(
  businessId: string | null | undefined,
  partyId: string | null | undefined,
  agreementId: string | null | undefined
): SiteLock {
  const { data } = useGetSiteClosedThroughQuery(
    { businessId: businessId ?? '', partyId: partyId ?? '', agreementId: agreementId ?? '' },
    { skip: !businessId || !partyId || !agreementId }
  );
  return useMemo(() => {
    if (!data) return { message: '', isLocked: () => false };
    const { fy, lockedThrough } = data;
    return {
      fy,
      lockedThrough,
      message: closedYearMessage(fy, lockedThrough),
      isLocked: day => !!day && isOnOrBeforeDay(day, lockedThrough),
    };
  }, [data]);
}
