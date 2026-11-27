import { describe, expect, it } from 'vitest';
import { siteLabel } from './sites';

describe('siteLabel', () => {
  const sites = [
    { code: 'BISRAKH', address: 'Plot 12, Sector 4, Greater Noida' },
    { code: 'EMPTY', address: '  ' },
  ];

  it('joins the site code and full address', () => {
    expect(siteLabel('BISRAKH', sites)).toBe('BISRAKH — Plot 12, Sector 4, Greater Noida');
  });

  it('falls back to the code when the site or its address is missing', () => {
    expect(siteLabel('GONE', sites)).toBe('GONE');
    expect(siteLabel('EMPTY', sites)).toBe('EMPTY');
    expect(siteLabel('BISRAKH', undefined)).toBe('BISRAKH');
  });
});
